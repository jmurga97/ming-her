import { fixed, jevModel, options, outputTokens, policyTrace, toolOf } from "./jev";

import type { Option, Thresholds, Turn } from "./jev";
import type { ReactNode } from "react";

const STEP_STATUS = { hit: " (cambió la respuesta)", pass: " (superado)", off: " (no aplica)" } as const;

function Brace({ lit, children }: { lit: boolean; children: ReactNode }) {
  return (
    <div className="ti-brace" data-lit={lit}>
      <span className="ti-brace__mark" aria-hidden="true" />
      {children}
    </div>
  );
}

// One option row: probability bar, the threshold tick where one applies, and the signal dot when chosen.
function Bar({
  label,
  value,
  max = 1,
  threshold,
  chosen,
}: {
  label: string;
  value: number;
  max?: number;
  threshold?: number;
  chosen: boolean;
}) {
  return (
    <li className="ti-option" data-chosen={chosen}>
      <span className="ti-option__dot" aria-hidden="true" />
      <span className="ti-option__label">
        {label}
        {chosen && <span className="ming-visually-hidden"> (elegida)</span>}
      </span>
      <span className="ti-bar" aria-hidden="true">
        <span className="ti-bar__fill" style={{ inlineSize: `${Math.min(value / max, 1) * 100}%` }} />
        {threshold !== undefined && (
          <span className="ti-bar__tick" style={{ insetInlineStart: `${Math.min(threshold / max, 1) * 100}%` }} />
        )}
      </span>
      <span className="ti-option__value">
        {fixed(value)}
        {threshold !== undefined && <span className="ti-option__threshold"> / {threshold}</span>}
      </span>
    </li>
  );
}

function Question({ name, note, children }: { name: string; note: string; children: ReactNode }) {
  return (
    <div className="ti-question">
      <div className="ti-question__head">
        <h4>{name}</h4>
        <p>{note}</p>
      </div>
      <Brace lit>
        <ul className="ti-options">{children}</ul>
      </Brace>
    </div>
  );
}

function ChoiceBars({
  list,
  chosen,
  threshold,
}: {
  list: Option[];
  chosen: string | null;
  threshold?: (id: string) => number | undefined;
}) {
  if (list.length === 0) return <li className="ti-option__empty">Sin probabilidades guardadas</li>;
  return list.map((option) => (
    <Bar
      key={option.id}
      label={option.label}
      value={option.probability}
      threshold={threshold?.(option.id)}
      chosen={option.id === chosen}
    />
  ));
}

// Left to right: the input Jev read, its four answers, the policy steps and what the Worker replied.
export function BraceTree({ turn, context, thresholds }: { turn: Turn; context: string; thresholds: Thresholds }) {
  const judged = turn.intent !== null;
  const steps = policyTrace(turn, thresholds);
  const guard = (turn.injection ?? 0) >= thresholds.injection;
  const frustrationLevel = turn.frustration === null ? null : String(Math.round(turn.frustration));

  return (
    <div className="ti-tree">
      <dl className="ti-input">
        <div>
          <dt>caller_says</dt>
          <dd className="ti-input__caller">{turn.utterance}</dd>
        </div>
        <div>
          <dt>receptionist_last_said</dt>
          <dd>{context}</dd>
        </div>
      </dl>

      <div className="ti-flow">
        <div className="ti-col">
          <h3 className="ming-eyebrow">{jevModel(turn) ?? "Jev"} · 4 preguntas en paralelo</h3>
          <Brace lit={judged}>
            {judged ? (
              <div className="ti-questions">
                <Question name="intent" note={`Elegida: ${turn.intent} · confianza ${fixed(turn.intentConfidence)}`}>
                  <ChoiceBars
                    list={options(turn, "intent")}
                    chosen={turn.intent}
                    threshold={(id) => thresholds.intent[id]}
                  />
                </Question>
                <Question
                  name="department"
                  note={`Elegido: ${turn.department} · confianza ${fixed(turn.departmentConfidence)}`}
                >
                  <ChoiceBars
                    list={options(turn, "department")}
                    chosen={turn.department}
                    threshold={(id) => (id === "none" ? undefined : thresholds.department)}
                  />
                </Question>
                <Question name="injection" note="Noul: probabilidad de que intente cambiar las reglas">
                  <Bar label="noul" value={turn.injection ?? 0} threshold={thresholds.injection} chosen={guard} />
                </Question>
                <Question name="frustration" note={`Score ${fixed(turn.frustration)} de 0 a 2`}>
                  <ChoiceBars list={options(turn, "frustration")} chosen={frustrationLevel} />
                  <Bar
                    label="score"
                    value={turn.frustration ?? 0}
                    max={2}
                    threshold={thresholds.apology}
                    chosen={(turn.frustration ?? 0) >= thresholds.apology}
                  />
                </Question>
              </div>
            ) : (
              <p className="ti-muted">
                {turn.outcome === "silence"
                  ? "Silencio: no se preguntó a Jev."
                  : `Jev falló: ${turn.error ?? "sin detalle"}`}
              </p>
            )}
          </Brace>
        </div>

        <div className="ti-col">
          <h3 className="ming-eyebrow">Política</h3>
          <Brace lit>
            <ol className="ti-steps">
              {steps.map((step) => (
                <li key={step.id} className="ti-step" data-status={step.status}>
                  <span className="ti-option__dot" aria-hidden="true" />
                  <span className="ti-step__label">
                    {step.label}
                    <span className="ming-visually-hidden">{STEP_STATUS[step.status]}</span>
                  </span>
                  <span className="ti-step__note">{step.note}</span>
                </li>
              ))}
            </ol>
          </Brace>
        </div>

        <div className="ti-col">
          <h3 className="ming-eyebrow">Respuesta</h3>
          <Brace lit>
            <dl className="ti-result">
              <dt>outcome</dt>
              <dd>{turn.outcome}</dd>
              <dt>action</dt>
              <dd>{turn.action ?? "–"}</dd>
              <dt>tool</dt>
              <dd>{toolOf(turn) ?? "Ninguna"}</dd>
              <dt>reply</dt>
              <dd className="ti-result__reply">{turn.reply}</dd>
              <dt>Latencia</dt>
              <dd>
                <span className="ti-bar" aria-hidden="true">
                  <span
                    className="ti-bar__fill"
                    style={{ inlineSize: `${turn.totalMs > 0 ? ((turn.jevMs ?? 0) / turn.totalMs) * 100 : 0}%` }}
                  />
                </span>
                <span className="ti-figure">
                  Jev {turn.jevMs ?? "–"} ms de {turn.totalMs} ms
                </span>
              </dd>
              <dt>Tokens</dt>
              <dd className="ti-figure">
                {turn.inputTokens ?? "–"} entrada · {outputTokens(turn) ?? "–"} salida
              </dd>
            </dl>
          </Brace>
        </div>
      </div>
    </div>
  );
}
