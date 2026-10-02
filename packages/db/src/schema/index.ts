import { sql } from "drizzle-orm";
import { integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

// One row per final caller turn. A retried request for the same turn replaces the row.
// Action counters are `SELECT action, COUNT(*) FROM turns GROUP BY action`.
export const turns = sqliteTable(
  "turns",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    conversationId: text("conversation_id").notNull(),
    turnIndex: integer("turn_index").notNull(),
    utterance: text("utterance").notNull(),
    intent: text("intent"),
    intentConfidence: real("intent_confidence"),
    department: text("department"),
    departmentConfidence: real("department_confidence"),
    injection: real("injection"),
    frustration: real("frustration"),
    outcome: text("outcome").notNull(),
    action: text("action"),
    reply: text("reply").notNull(),
    jevMs: integer("jev_ms"),
    totalMs: integer("total_ms").notNull(),
    inputTokens: integer("input_tokens"),
    jevAnswers: text("jev_answers", { mode: "json" }),
    error: text("error"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch('subsec') * 1000)`),
  },
  (table) => [uniqueIndex("turns_conversation_turn").on(table.conversationId, table.turnIndex)],
);
