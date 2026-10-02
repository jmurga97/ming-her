import { createDb } from "@ming-her/db/client";
import { turns } from "@ming-her/db/schema";

import { askJev } from "./jev";
import { decide, ERROR_DECISION, SILENCE_DECISION } from "./policy";

import type { JevResult } from "./jev";
import type { Decision } from "./policy";

// ElevenLabs Agents "Custom LLM": an OpenAI-compatible chat completions endpoint. Jev and the policy
// decide; no LLM runs here. The agent's system prompt must contain `conversation_id: {{system__conversation_id}}`.

type Message = { role: string; content?: string | { type: string; text?: string }[] | null };
type ChatRequest = { messages?: Message[]; tools?: { function?: { name?: string } }[]; stream?: boolean };

export async function handleChatCompletions({
  request,
  env,
  ctx,
}: {
  request: Request;
  env: Env;
  ctx: ExecutionContext;
}): Promise<Response> {
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });
  if (request.headers.get("authorization") !== `Bearer ${env.LLM_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  const startedAt = Date.now();
  const body = (await request.json().catch(() => null)) as ChatRequest | null;
  const messages = Array.isArray(body?.messages) ? body.messages : [];
  const userIndexes = messages.flatMap((message, index) => (message.role === "user" ? [index] : []));
  const lastUserIndex = userIndexes.at(-1);
  if (lastUserIndex === undefined) return new Response("No user message", { status: 400 });

  const utterance = textOf(messages[lastUserIndex]);
  const receptionistLastSaid = textOf(messages.slice(0, lastUserIndex).findLast((m) => m.role === "assistant"));
  const conversationId =
    /conversation_id:\s*([\w-]+)/.exec(messages.map((message) => textOf(message)).join("\n"))?.[1] ?? "unknown";

  // ElevenLabs sends "..." when the caller stays silent; there is nothing for Jev to judge.
  const silent = !/\p{L}/u.test(utterance);
  const jevStartedAt = Date.now();
  const { jev, jevError } = silent
    ? { jev: null, jevError: null }
    : await judge(env.JEV_API_KEY, { receptionist_last_said: receptionistLastSaid, caller_says: utterance });
  const jevMs = Date.now() - jevStartedAt;
  let decision = jev ? decide(jev.judgments, receptionistLastSaid) : ERROR_DECISION;
  if (silent) decision = SILENCE_DECISION;
  // Only call tools the agent offers: the browser widget has no `transfer_call`, the Asterisk bridge does.
  const offered = new Set(body?.tools?.map((tool) => tool.function?.name));
  const tool = decision.tool && offered.has(decision.tool.name) ? decision.tool : null;
  const totalMs = Date.now() - startedAt;

  const row = {
    conversationId,
    turnIndex: userIndexes.length,
    utterance,
    intent: jev?.judgments.intent.choice ?? null,
    intentConfidence: jev?.judgments.intent.confidence ?? null,
    department: jev?.judgments.department.choice ?? null,
    departmentConfidence: jev?.judgments.department.confidence ?? null,
    injection: jev?.judgments.injection ?? null,
    frustration: jev?.judgments.frustration ?? null,
    outcome: decision.outcome,
    action: decision.action,
    reply: decision.reply,
    jevMs: jev ? jevMs : null,
    totalMs,
    inputTokens: jev?.inputTokens ?? null,
    jevAnswers: jev?.raw ?? null,
    error: jevError,
  };
  ctx.waitUntil(
    createDb(env.DB)
      .insert(turns)
      .values(row)
      .onConflictDoUpdate({ target: [turns.conversationId, turns.turnIndex], set: row })
      .catch((error: unknown) => console.error("Turn log failed:", { error })),
  );

  if (body?.stream === false) return Response.json({ decision: { ...decision, tool }, turn: row });
  return streamCompletion(decision, tool);
}

async function judge(
  apiKey: string,
  state: Parameters<typeof askJev>[1],
): Promise<{ jev: JevResult | null; jevError: string | null }> {
  try {
    return { jev: await askJev(apiKey, state), jevError: null };
  } catch (error) {
    console.error("Jev request failed:", { error });
    return { jev: null, jevError: error instanceof Error ? error.message : String(error) };
  }
}

function textOf(message: Message | undefined): string {
  const content = message?.content;
  if (typeof content === "string") return content;
  return content?.map((part) => part.text ?? "").join("") ?? "";
}

function streamCompletion(decision: Decision, tool: Decision["tool"]): Response {
  const id = `chatcmpl-${crypto.randomUUID()}`;
  const created = Math.floor(Date.now() / 1000);
  const chunk = (delta: object, finishReason: string | null = null): string =>
    `data: ${JSON.stringify({ id, object: "chat.completion.chunk", created, model: "jev-policy", choices: [{ index: 0, delta, finish_reason: finishReason }] })}\n\n`;

  const events = [chunk({ role: "assistant", content: decision.reply })];
  if (tool) {
    const call = {
      index: 0,
      id: `call_${crypto.randomUUID()}`,
      type: "function",
      function: { name: tool.name, arguments: JSON.stringify(tool.args) },
    };
    events.push(chunk({ tool_calls: [call] }), chunk({}, "tool_calls"));
  } else {
    events.push(chunk({}, "stop"));
  }
  events.push("data: [DONE]\n\n");
  return new Response(events.join(""), {
    headers: { "content-type": "text/event-stream", "cache-control": "no-cache" },
  });
}
