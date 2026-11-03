import { AppShell, InlineMessage, OverviewPanel, SidebarNav, StatusText, Switch } from "@jmurga97/components";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { trpc } from "~/lib/trpc";

import { BraceTree } from "./brace-tree";
import { Chat, TurnPicker } from "./conversation";
import { D1Row } from "./d1-row";
import { agentLine, turnName } from "./jev";

import type { Turn } from "./jev";
import type { LiveData } from "~/lib/trpc";

import "./turn-inspector.css";

const NARROW = "(max-width: 56rem)";

type Conversation = LiveData["conversations"][number];

function percentile(values: number[], p: number): string {
  const sorted = values.toSorted((a, b) => a - b);
  const value = sorted[Math.ceil((p / 100) * sorted.length) - 1];
  return value === undefined ? "–" : `${value} ms`;
}

function time(ms: number): string {
  return new Date(ms).toLocaleString("es-ES", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

function title(conversation: Conversation): string {
  return `${conversation.kind === "run" ? "Escenarios" : "Llamada"} · ${time(conversation.lastAt)}`;
}

function size(conversation: Conversation): string {
  return `${conversation.turns} ${conversation.kind === "run" ? "casos" : "turnos"}`;
}

// The selected conversation, top to bottom: the braces of one turn, the turn picker, then the chat and counters.
function ConversationDetail({
  data,
  conversation,
  index,
  onSelect,
}: {
  data: LiveData;
  conversation: Conversation;
  index: number;
  onSelect: (turn: Turn) => void;
}) {
  const turns = data.turns;
  const turn = turns[index];
  if (!turn) return null;
  const isRun = conversation.kind === "run";
  const context = agentLine(turn.receptionistLastSaid);
  const jevMs = turns.flatMap((row) => (row.jevMs === null ? [] : [row.jevMs]));

  return (
    <>
      <section className="ming-section" aria-labelledby="ti-decision-title">
        <div className="ti-section-head">
          <h2 id="ti-decision-title" className="ming-section__title">
            Decisión de Jev · {turnName(turn, conversation.id)}
          </h2>
          <span className="ti-muted">
            {new Date(turn.createdAt).toLocaleTimeString("es-ES")} · {turn.totalMs} ms
          </span>
        </div>
        <BraceTree key={turn.id} turn={turn} context={context} thresholds={data.thresholds} />
        <details className="ti-raw">
          <summary>Fila guardada en D1</summary>
          <D1Row turn={turn} />
        </details>
      </section>

      <nav className="ming-section" aria-labelledby="ti-turns-title">
        <h2 id="ti-turns-title" className="ming-section__title">
          {isRun ? "Casos de este run" : "Turnos de esta conversación"}
        </h2>
        <TurnPicker turns={turns} conversationId={conversation.id} selectedId={turn.id} onSelect={onSelect} />
      </nav>

      <div className="ming-split">
        <section className="ming-section" aria-labelledby="ti-chat-title">
          <h2 id="ti-chat-title" className="ming-section__title">
            {isRun ? "Casos" : "Conversación"}
          </h2>
          <Chat turns={turns} conversationId={conversation.id} selectedId={turn.id} onSelect={onSelect} isRun={isRun} />
        </section>
        <aside className="ming-stack ming-stack--loose" aria-label="Contadores">
          <OverviewPanel
            title="Esta conversación"
            stats={[
              { id: "turns", label: isRun ? "Casos" : "Turnos", value: String(turns.length) },
              { id: "actions", label: "Acciones", value: String(turns.filter((row) => row.action).length) },
              { id: "jev", label: "Jev p50", value: percentile(jevMs, 50) },
              {
                id: "total",
                label: "Total p95",
                value: percentile(
                  turns.map((row) => row.totalMs),
                  95,
                ),
              },
            ]}
          />
          <OverviewPanel
            title="Contadores"
            description="Todas las conversaciones: GROUP BY action"
            stats={data.actionCounts.map((row) => ({
              id: row.action ?? "none",
              label: row.action ?? "Sin acción",
              value: row.turns.toLocaleString("es-ES"),
            }))}
          />
        </aside>
      </div>
    </>
  );
}

export function InspectorPage() {
  const [navOpen, setNavOpen] = useState(() => !window.matchMedia(NARROW).matches);
  // Live: follow the newest conversation and its newest turn. Picking a conversation or a turn pauses it.
  const [live, setLive] = useState(true);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [turnId, setTurnId] = useState<number | null>(null);

  const query = useQuery(
    trpc.live.queryOptions(
      { conversationId: live ? undefined : conversationId },
      { refetchInterval: 1000, placeholderData: keepPreviousData },
    ),
  );
  const data = query.data;
  const conversation = data?.conversation ?? null;
  const turns = data?.turns ?? [];
  const index = live || turnId === null ? turns.length - 1 : turns.findIndex((row) => row.id === turnId);
  const turn = turns[index];

  function pickConversation(id: string): void {
    if (window.matchMedia(NARROW).matches) setNavOpen(false);
    setLive(false);
    setConversationId(id);
    setTurnId(null);
  }

  function pickTurn(row: Turn): void {
    setLive(false);
    setConversationId(conversation?.id);
    setTurnId(row.id);
  }

  function toggleLive(next: boolean): void {
    setLive(next);
    if (next) setTurnId(null);
    else setConversationId(conversation?.id);
  }

  const status = live ? { tone: "success" as const, label: "En vivo" } : { tone: "neutral" as const, label: "Pausado" };

  return (
    <AppShell
      open={navOpen}
      onOpenChange={setNavOpen}
      navigationLabel="Conversaciones"
      navigation={
        <SidebarNav
          ariaLabel="Conversaciones"
          header={
            <div className="ming-stack ming-stack--tight">
              <p className="ming-eyebrow">Her · Fase 1</p>
              <strong>Conversaciones</strong>
            </div>
          }
          items={(data?.conversations ?? []).map((item) => ({
            id: item.id,
            label: title(item),
            description: size(item),
            current: item.id === conversation?.id,
          }))}
          footer={
            query.isError ? (
              <StatusText polite tone="error" label="Sin conexión con la API" />
            ) : (
              <StatusText polite tone={status.tone} label={status.label} />
            )
          }
          onNavigate={pickConversation}
        />
      }
      header={
        <nav aria-label="Breadcrumb">
          <ol className="ming-breadcrumb">
            <li>Conversaciones</li>
            <li aria-current="page">{conversation ? title(conversation) : "Sin conversaciones"}</li>
          </ol>
        </nav>
      }
    >
      <div className="ming-page">
        <header className="ming-page-header">
          <div className="ming-page-header__title">
            <p className="ming-eyebrow">{conversation ? size(conversation) : "Fase 1"}</p>
            <h1>{conversation ? title(conversation) : "Inspector de conversaciones"}</h1>
            <p className="ti-muted">
              {conversation?.id ?? "Cada llamada a ElevenLabs aparece aquí en cuanto se guarda su primer turno."}
            </p>
          </div>
          <div className="ming-page-header__actions">
            <Switch label="Seguir en vivo" checked={live} onCheckedChange={toggleLive} />
          </div>
        </header>

        {query.isError && (
          <InlineMessage
            tone="error"
            title="No se pudo leer D1"
            message="Comprueba que `bun run dev` está en marcha. Se reintenta cada segundo."
          />
        )}

        {data && conversation && turn ? (
          <ConversationDetail data={data} conversation={conversation} index={index} onSelect={pickTurn} />
        ) : (
          !query.isError && (
            <div className="ming-empty">
              <h2>{query.isPending ? "Cargando conversaciones…" : "Aún no hay conversaciones"}</h2>
              <p>Habla con el agente desde ElevenLabs; la llamada aparece aquí en cuanto se guarda su primer turno.</p>
            </div>
          )
        )}
      </div>
    </AppShell>
  );
}
