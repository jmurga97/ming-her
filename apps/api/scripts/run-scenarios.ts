// Sends each scenario through the Custom LLM endpoint as text and reports accuracy, calibration and latency.
// Usage (with `bun run dev` running): bun run --cwd apps/api scenarios
import { readFile } from "node:fs/promises";

const ENDPOINT = process.env.ENDPOINT ?? "http://127.0.0.1:8791/v1/chat/completions";
const BANDS = [0, 0.5, 0.7, 0.9] as const;

type Scenario = { id: string; category: string; receptionist_last_said?: string; caller_says: string; expect: string };
type Turn = { intentConfidence: number | null; totalMs: number; jevMs: number | null };
type Result = Scenario & { outcome: string; reply: string; turn: Turn };

const runId = `scenarios-${Date.now()}`;
const results: Result[] = [];
const scenarios = JSON.parse(await readFile(new URL("scenarios.json", import.meta.url), "utf8")) as Scenario[];
for (const scenario of scenarios) {
  const messages = [{ role: "system", content: `conversation_id: ${runId}-${scenario.id}` }];
  if (scenario.receptionist_last_said) messages.push({ role: "assistant", content: scenario.receptionist_last_said });
  messages.push({ role: "user", content: scenario.caller_says });
  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers: { authorization: `Bearer ${process.env.LLM_SECRET}`, "content-type": "application/json" },
    body: JSON.stringify({ messages, stream: false }),
  });
  if (!response.ok) throw new Error(`${scenario.id}: HTTP ${response.status} ${await response.text()}`);
  const { decision, turn } = (await response.json()) as { decision: { outcome: string; reply: string }; turn: Turn };
  const result = { ...scenario, outcome: decision.outcome, reply: decision.reply, turn };
  results.push(result);
  const mark = result.outcome === scenario.expect ? "✓" : "✗";
  const confidence = turn.intentConfidence?.toFixed(2) ?? "-";
  console.log(
    `${mark} ${scenario.id.padEnd(28)} expect=${scenario.expect.padEnd(18)} got=${result.outcome.padEnd(18)} conf=${confidence} ${turn.totalMs}ms`,
  );
}

const pass = (result: Result): boolean => result.outcome === result.expect;
const rate = (group: Result[]): string => `${group.filter(pass).length}/${group.length}`;

console.log("\nAccuracy by category");
for (const category of new Set(results.map((result) => result.category))) {
  console.log(`  ${category.padEnd(14)} ${rate(results.filter((result) => result.category === category))}`);
}
console.log(`  ${"total".padEnd(14)} ${rate(results)}`);

console.log("\nAccuracy by intent confidence band");
for (const [index, low] of BANDS.entries()) {
  const high = BANDS[index + 1] ?? 1.01;
  const band = results.filter(
    (result) => (result.turn.intentConfidence ?? -1) >= low && (result.turn.intentConfidence ?? -1) < high,
  );
  if (band.length > 0) console.log(`  [${low.toFixed(1)}, ${Math.min(high, 1).toFixed(1)}) ${rate(band)}`);
}

const percentile = (values: number[], p: number): number =>
  values.toSorted((a, b) => a - b)[Math.ceil((p / 100) * values.length) - 1] ?? 0;
const jevMs = results.flatMap((result) => (result.turn.jevMs === null ? [] : [result.turn.jevMs]));
const totalMs = results.map((result) => result.turn.totalMs);
console.log(
  `\nLatency  jev p50=${percentile(jevMs, 50)}ms p95=${percentile(jevMs, 95)}ms  total p50=${percentile(totalMs, 50)}ms p95=${percentile(totalMs, 95)}ms`,
);
console.log(`Turns stored in D1 under conversation_id ${runId}-*`);
