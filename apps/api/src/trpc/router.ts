import { turns } from "@ming-her/db/schema";
import { initTRPC, TRPCError } from "@trpc/server";
import { asc, count, desc, sql } from "drizzle-orm";

import { APOLOGY_FRUSTRATION, MAX_INJECTION, MIN_DEPARTMENT_CONFIDENCE, MIN_INTENT_CONFIDENCE } from "../agent/policy";

import type { DrizzleDb } from "@ming-her/db/client";

const t = initTRPC.context<{ db: DrizzleDb }>().create();

// run-scenarios.ts stores each case as `scenarios-<run>-<case>`, a one-turn conversation of its own.
// Grouping a run under `scenarios-<run>` keeps the sidebar to one entry per call or per run.
const RUN_PREFIX = "scenarios-";
const conversationKey = sql<string>`CASE WHEN ${turns.conversationId} LIKE 'scenarios-%-%'
  THEN substr(${turns.conversationId}, 1, 9 + instr(substr(${turns.conversationId}, 11), '-'))
  ELSE ${turns.conversationId} END`;

function liveInput(value: unknown): { conversationId?: string } {
  if (value === undefined || value === null) return {};
  const conversationId = (value as { conversationId?: unknown }).conversationId;
  if (conversationId === undefined) return {};
  if (typeof conversationId !== "string" || conversationId.length > 200) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "conversationId must be a short string" });
  }
  return { conversationId };
}

export const appRouter = t.router({
  health: t.procedure.query(async ({ ctx }) => {
    const result = await ctx.db.get<{ ok: number }>(sql`SELECT 1 AS ok`);
    if (result?.ok !== 1) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "D1 check failed" });
    return { status: "ok" as const, database: "connected" as const };
  }),
  // Everything the conversation inspector shows, in one round trip; the web polls it every second.
  live: t.procedure.input(liveInput).query(async ({ ctx, input }) => {
    const lastAt = sql<number>`max(${turns.createdAt})`.mapWith(Number);
    const groups = await ctx.db
      .select({ id: conversationKey, turns: count(), lastAt })
      .from(turns)
      .groupBy(conversationKey)
      .orderBy(desc(lastAt))
      .limit(30);
    const conversations = groups.map((group) => ({
      ...group,
      kind: group.id.startsWith(RUN_PREFIX) ? ("run" as const) : ("call" as const),
    }));
    const conversationId = input.conversationId ?? conversations[0]?.id ?? null;
    const rows = conversationId
      ? await ctx.db
          .select()
          .from(turns)
          .where(sql`${conversationKey} = ${conversationId}`)
          .orderBy(asc(turns.turnIndex), asc(turns.id))
      : [];
    const actionCounts = await ctx.db
      .select({ action: turns.action, turns: count() })
      .from(turns)
      .groupBy(turns.action)
      .orderBy(desc(count()));
    return {
      conversations,
      conversation: conversations.find((conversation) => conversation.id === conversationId) ?? null,
      // Without a transformer a Date would arrive as a string; send epoch ms.
      turns: rows.map((row) => ({ ...row, createdAt: row.createdAt.getTime() })),
      actionCounts,
      thresholds: {
        intent: MIN_INTENT_CONFIDENCE,
        department: MIN_DEPARTMENT_CONFIDENCE,
        injection: MAX_INJECTION,
        apology: APOLOGY_FRUSTRATION,
      },
    };
  }),
});

export type AppRouter = typeof appRouter;
