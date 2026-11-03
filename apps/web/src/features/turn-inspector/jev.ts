import type { LiveData } from "~/lib/trpc";

export type Turn = LiveData["turns"][number];
export type Thresholds = LiveData["thresholds"];
export type Option = { id: string; label: string; probability: number };

type RawAnswer = { probabilities?: Record<string, unknown>; legend?: Record<string, unknown>; score?: unknown };
type Raw = { model?: unknown; answers?: Record<string, RawAnswer>; usage?: { output_tokens?: unknown } };

function raw(turn: Turn): Raw | null {
  return typeof turn.jevAnswers === "object" && turn.jevAnswers !== null ? turn.jevAnswers : null;
}

// Options of a choice/score question with Jev's probabilities, most likely first.
export function options(turn: Turn, question: "intent" | "department" | "frustration"): Option[] {
  const answer = raw(turn)?.answers?.[question];
  return Object.entries(answer?.probabilities ?? {})
    .flatMap(([id, probability]) => {
      if (typeof probability !== "number") return [];
      const legend = answer?.legend?.[id];
      return [{ id, label: typeof legend === "string" ? `${id} · ${legend}` : id, probability }];
    })
    .toSorted((a, b) => (question === "frustration" ? a.id.localeCompare(b.id) : b.probability - a.probability));
}

export function jevModel(turn: Turn): string | null {
  const model = raw(turn)?.model;
  return typeof model === "string" ? model : null;
}

export function outputTokens(turn: Turn): number | null {
  const tokens = raw(turn)?.usage?.output_tokens;
  return typeof tokens === "number" ? tokens : null;
}

export function fixed(value: number | null | undefined): string {
  return value === null || value === undefined ? "–" : value.toFixed(2);
}

export type Step = {
  id: string;
  label: string;
  note: string;
  // hit: this step changed the reply · pass: evaluated, let the turn through · off: not reached.
  status: "hit" | "pass" | "off";
};

type Context = { turn: Turn; thresholds: Thresholds; judged: boolean; routed: boolean };

const compare = (value: number, min: number): string => `${fixed(value)} ${value >= min ? "≥" : "<"} ${min}`;

function silenceStep({ turn }: Context): Step {
  const base = { id: "silence", label: "¿Silencio?" };
  if (turn.outcome === "silence") return { ...base, status: "hit", note: "Sin palabras: no se pregunta a Jev" };
  return { ...base, status: "pass", note: "Hay palabras: se pregunta a Jev" };
}

function jevStep({ turn }: Context): Step {
  const base = { id: "jev", label: "Respuesta de Jev" };
  if (turn.outcome === "silence") return { ...base, status: "off", note: "No se llamó" };
  if (turn.outcome === "error") return { ...base, status: "hit", note: turn.error ?? "Jev falló" };
  return { ...base, status: "pass", note: `4 juicios en ${turn.jevMs ?? "–"} ms` };
}

function guardStep({ turn, thresholds, judged, routed }: Context): Step {
  const base = { id: "guard", label: "Guarda contra inyección" };
  if (!judged) return { ...base, status: "off", note: "–" };
  const note = `injection ${compare(turn.injection ?? 0, thresholds.injection)}`;
  return { ...base, status: routed ? "pass" : "hit", note };
}

function confidenceStep({ turn, thresholds, routed }: Context): Step {
  const base = { id: "confidence", label: "Umbral del intent" };
  if (!routed || turn.intent === null) return { ...base, status: "off", note: "–" };
  const min = thresholds.intent[turn.intent];
  if (min === undefined) return { ...base, status: "hit", note: `${turn.intent} no tiene umbral: pedir aclaración` };
  const confidence = turn.intentConfidence ?? 0;
  return { ...base, status: confidence >= min ? "pass" : "hit", note: `${turn.intent} ${compare(confidence, min)}` };
}

function departmentStep({ turn, thresholds, routed }: Context): Step {
  const base = { id: "department", label: "Departamento" };
  if (!routed || turn.intent !== "transfer") return { ...base, status: "off", note: "Solo si el intent es transfer" };
  if (turn.department === "none") return { ...base, status: "hit", note: "none: preguntar sales, support o billing" };
  // A transfer also needs the intent threshold; otherwise the policy confirms the department.
  const passed = turn.action === "transfer";
  const note = `${turn.department} ${compare(turn.departmentConfidence ?? 0, thresholds.department)}`;
  return { ...base, status: passed ? "pass" : "hit", note };
}

function repeatStep({ turn }: Context): Step {
  const base = { id: "repeat", label: "No repetir el menú" };
  if (turn.outcome === "clarify_again") {
    return { ...base, status: "hit", note: "El agente ya dio el menú: ofrecer una persona" };
  }
  if (turn.outcome === "clarify") return { ...base, status: "pass", note: "Primera vez: se da el menú" };
  return { ...base, status: "off", note: "Solo si toca aclarar" };
}

function apologyStep({ turn, thresholds, judged }: Context): Step {
  const base = { id: "apology", label: "Disculpa por frustración" };
  if (!judged) return { ...base, status: "off", note: "–" };
  const frustration = turn.frustration ?? 0;
  const apology = frustration >= thresholds.apology && turn.action !== "end_call";
  return { ...base, status: apology ? "hit" : "pass", note: `frustration ${compare(frustration, thresholds.apology)}` };
}

// ponytail: mirrors decide() in apps/api/src/agent/policy.ts for display only; persist a trace column if they drift.
export function policyTrace(turn: Turn, thresholds: Thresholds): Step[] {
  const judged = turn.outcome !== "silence" && turn.outcome !== "error" && turn.intent !== null;
  const routed = judged && (turn.injection ?? 0) < thresholds.injection;
  const context = { turn, thresholds, judged, routed };
  return [silenceStep, jevStep, guardStep, confidenceStep, departmentStep, repeatStep, apologyStep].map((step) =>
    step(context),
  );
}

export function toolOf(turn: Turn): string | null {
  if (turn.action === "end_call") return "end_call";
  if (turn.action === "transfer") return `transfer_call (${turn.department}) · el widget no lo ofrece`;
  return null;
}

// A call names its turns by number; a scenario run names each case.
export function turnName(turn: Turn, conversationId: string): string {
  if (turn.conversationId === conversationId) return `Turno ${turn.turnIndex}`;
  return turn.conversationId.slice(conversationId.length + 1);
}

// What the agent had said before the turn, as stored. Rows from before the column existed have NULL.
export function agentLine(saved: string | null): string {
  if (saved === null) return "No guardado (turno anterior a la columna receptionist_last_said)";
  return saved === "" ? "(nada: quien llama habla primero)" : saved;
}
