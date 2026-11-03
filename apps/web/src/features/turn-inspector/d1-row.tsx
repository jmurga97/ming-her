import type { Turn } from "./jev";

// The exact row upserted into D1 `turns` by (conversation_id, turn_index), column by column.
export function D1Row({ turn }: { turn: Turn }) {
  const columns: [string, string | number | null][] = [
    ["id", turn.id],
    ["conversation_id", turn.conversationId],
    ["turn_index", turn.turnIndex],
    ["utterance", turn.utterance],
    ["receptionist_last_said", turn.receptionistLastSaid],
    ["intent", turn.intent],
    ["intent_confidence", turn.intentConfidence],
    ["department", turn.department],
    ["department_confidence", turn.departmentConfidence],
    ["injection", turn.injection],
    ["frustration", turn.frustration],
    ["outcome", turn.outcome],
    ["action", turn.action],
    ["reply", turn.reply],
    ["jev_ms", turn.jevMs],
    ["total_ms", turn.totalMs],
    ["input_tokens", turn.inputTokens],
    ["error", turn.error],
    ["created_at", new Date(turn.createdAt).toISOString()],
  ];
  return (
    <div className="ming-stack">
      <dl className="ti-row ming-data">
        {columns.map(([name, value]) => (
          <div key={name}>
            <dt>{name}</dt>
            <dd>{value ?? "NULL"}</dd>
          </div>
        ))}
      </dl>
      <details className="ti-raw">
        <summary>jev_answers (respuesta cruda de Jev)</summary>
        <pre className="ming-data">{JSON.stringify(turn.jevAnswers, null, 2) ?? "NULL"}</pre>
      </details>
    </div>
  );
}
