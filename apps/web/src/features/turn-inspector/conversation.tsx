import { Badge } from "@jmurga97/components";

import { agentLine, fixed, toolOf, turnName } from "./jev";

import type { Turn } from "./jev";

function outcomeTone(turn: Turn): "success" | "error" | "neutral" {
  if (turn.action) return "success";
  return turn.outcome === "error" ? "error" : "neutral";
}

// What Jev judged, in one line, so the whole call reads without opening any detail.
function judgment(turn: Turn): string {
  if (turn.intent === null) return turn.outcome === "silence" ? "Silencio: sin Jev" : "Jev falló";
  return [
    `intent ${turn.intent} ${fixed(turn.intentConfidence)}`,
    `department ${turn.department} ${fixed(turn.departmentConfidence)}`,
    `injection ${fixed(turn.injection)}`,
    `frustration ${fixed(turn.frustration)}`,
  ].join(" · ");
}

type TurnListProps = {
  turns: Turn[];
  conversationId: string;
  selectedId: number | undefined;
  onSelect: (turn: Turn) => void;
};

// The turns of the conversation in order, as the path the call took. Picking one shows its braces.
export function TurnPicker({ turns, conversationId, selectedId, onSelect }: TurnListProps) {
  return (
    <ol className="ti-picker">
      {turns.map((turn) => (
        <li key={turn.id}>
          <button
            type="button"
            className="ti-picker__turn"
            aria-current={turn.id === selectedId ? "true" : undefined}
            onClick={() => onSelect(turn)}
          >
            <span className="ti-option__dot" aria-hidden="true" />
            <span className="ti-picker__name">{turnName(turn, conversationId)}</span>
            <Badge tone={outcomeTone(turn)}>{turn.outcome}</Badge>
          </button>
        </li>
      ))}
    </ol>
  );
}

// The whole call as a chat. Each exchange is also a way to pick its turn.
export function Chat({ turns, conversationId, selectedId, onSelect, isRun }: TurnListProps & { isRun: boolean }) {
  return (
    <ol className="ti-chat">
      {!isRun && turns[0] && (
        <li className="ti-chat__line ti-chat__line--agent">
          <span className="ti-chat__who">Agente · First message</span>
          <p>{agentLine(turns[0].receptionistLastSaid)}</p>
        </li>
      )}
      {turns.map((turn) => (
        <li key={turn.id}>
          <button
            type="button"
            className="ti-exchange"
            aria-current={turn.id === selectedId ? "true" : undefined}
            onClick={() => onSelect(turn)}
          >
            <span className="ti-exchange__head">
              <span className="ti-option__dot" aria-hidden="true" />
              {turnName(turn, conversationId)} · {new Date(turn.createdAt).toLocaleTimeString("es-ES")} · {turn.totalMs}{" "}
              ms
            </span>
            {isRun && turn.receptionistLastSaid && (
              <span className="ti-chat__line ti-chat__line--agent">
                <span className="ti-chat__who">Agente (contexto del caso)</span>
                <span>{turn.receptionistLastSaid}</span>
              </span>
            )}
            <span className="ti-chat__line">
              <span className="ti-chat__who">Quien llama</span>
              <span className="ti-chat__caller">{turn.utterance}</span>
              <span className="ti-muted">{judgment(turn)}</span>
            </span>
            <span className="ti-chat__line ti-chat__line--agent">
              <span className="ti-chat__who">Agente</span>
              <span>{turn.reply}</span>
              <span className="ti-muted">{[turn.outcome, toolOf(turn)].filter(Boolean).join(" · tool ")}</span>
            </span>
          </button>
        </li>
      ))}
    </ol>
  );
}
