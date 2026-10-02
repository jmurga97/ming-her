// Offline check of the decision policy: bun apps/api/scripts/check-policy.ts
import assert from "node:assert/strict";

import { decide } from "../src/agent/policy";

const choice = (
  value: string,
  confidence: number,
): { choice: string; confidence: number; probabilities: Record<string, number> } => ({
  choice: value,
  confidence,
  probabilities: {},
});
const judge = (
  intent: string,
  confidence = 0.95,
  department = "none",
  injection = 0,
  frustration = 0,
): Parameters<typeof decide>[0] => ({
  intent: choice(intent, confidence),
  department: choice(department, 0.95),
  injection,
  frustration,
});

assert.equal(decide(judge("book_appointment"), "").action, "book_appointment");
assert.equal(decide(judge("book_appointment", 0.4), "").outcome, "confirm");
assert.equal(decide(judge("transfer", 0.6, "sales"), "").reply, "Would you like me to put you through to sales?");
assert.equal(decide(judge("unclear"), "").outcome, "clarify");
assert.equal(
  decide(
    judge("unclear"),
    "Sorry, I didn't quite get that. Would you like to book an appointment, leave a message, get something by email, or speak with someone?",
  ).outcome,
  "clarify_again",
);
assert.equal(decide(judge("transfer"), "").outcome, "clarify_department");
assert.deepEqual(decide(judge("transfer", 0.9, "sales"), "").tool, {
  name: "transfer_call",
  args: { department: "sales" },
});
assert.equal(decide(judge("transfer", 0.9, "sales", 0.8), "").outcome, "guard");
assert.equal(decide(judge("transfer", 0.9, "sales", 0.8), "").action, null);
assert.equal(decide(judge("end_call"), "").tool?.name, "end_call");
assert.match(decide(judge("info", 0.9, "none", 0, 2), "").reply, /^I'm sorry/);
console.log("policy: OK");
