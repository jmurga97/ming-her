import type { ChoiceAnswer, Judgments } from "./jev";

export type Action = "book_appointment" | "leave_message" | "send_email" | "transfer" | "end_call";

export type Decision = {
  // Comparable with a scenario's `expect`: an action name, `transfer:<department>` or a branch name.
  outcome: string;
  action: Action | null;
  reply: string;
  tool: { name: string; args: Record<string, string> } | null;
};

// ponytail: starting thresholds by risk, unvalidated; calibrate them against scenario runs.
const MIN_INTENT_CONFIDENCE: Record<string, number> = {
  book_appointment: 0.6,
  leave_message: 0.6,
  send_email: 0.6,
  transfer: 0.7,
  end_call: 0.8,
  info: 0.5,
  small_talk: 0.5,
  out_of_scope: 0.5,
};
const MIN_DEPARTMENT_CONFIDENCE = 0.7;
const MAX_INJECTION = 0.5;
const APOLOGY_FRUSTRATION = 1.5;

const LINES = {
  book_appointment:
    "Done, I've noted your appointment request and the team will confirm the time with you. Anything else?",
  leave_message: "Got it, I've taken your message and someone will call you back. Anything else?",
  send_email: "Sure, I've noted that we should email that to you. Anything else?",
  end_call: "Thanks for calling Acme. Goodbye!",
  info: "We're open Monday to Friday, nine to six. Anything else I can help with?",
  out_of_scope:
    "Sorry, I can't help with that. I can book an appointment, take a message, email you information, or put you through to sales, support or billing.",
  clarify:
    "Sorry, I didn't quite get that. Would you like to book an appointment, leave a message, get something by email, or speak with someone?",
  clarify_again: "Sorry, I'm still not sure what you need. Would you like me to put you through to a person?",
  small_talk:
    "I'm well, thanks for asking! I'm Acme's automated assistant. I can book an appointment, take a message, email you information, or put you through to someone. What can I do for you?",
  clarify_department: "Sure. Would you like sales, support or billing?",
  guard: "I can only help with appointments, messages, emails and transfers. What can I do for you?",
  anything_else: "Is there anything else I can help with?",
  silence: "Are you still there?",
  error: "Sorry, could you say that again?",
} as const;

// Asked when Jev leans towards an action without reaching its threshold: confirm it rather than list every option.
const CONFIRM = {
  book_appointment: "Just to check, would you like to book an appointment?",
  leave_message: "Just to check, would you like to leave a message?",
  send_email: "Just to check, would you like us to email you something?",
} as const;

export const ERROR_DECISION: Decision = { outcome: "error", action: null, reply: LINES.error, tool: null };
export const SILENCE_DECISION: Decision = { outcome: "silence", action: null, reply: LINES.silence, tool: null };

export function decide(judgments: Judgments, receptionistLastSaid: string): Decision {
  let decision = route(judgments);
  // Never repeat the same menu: a second miss in a row offers a person instead.
  if (decision.outcome === "clarify" && receptionistLastSaid.includes(LINES.clarify)) decision = say("clarify_again");
  if (judgments.frustration < APOLOGY_FRUSTRATION || decision.action === "end_call") return decision;
  return { ...decision, reply: `I'm sorry for the trouble. ${decision.reply}` };
}

function route({ intent, department, injection }: Judgments): Decision {
  if (injection >= MAX_INJECTION) return say("guard");
  const confident = intent.confidence >= (MIN_INTENT_CONFIDENCE[intent.choice] ?? 1);
  switch (intent.choice) {
    case "book_appointment":
    case "leave_message":
    case "send_email": {
      if (!confident) return { outcome: "confirm", action: null, reply: CONFIRM[intent.choice], tool: null };
      return { outcome: intent.choice, action: intent.choice, reply: LINES[intent.choice], tool: null };
    }
    case "end_call": {
      if (!confident) return say("anything_else");
      return { outcome: "end_call", action: "end_call", reply: LINES.end_call, tool: { name: "end_call", args: {} } };
    }
    case "transfer": {
      return transfer(confident, department);
    }
    case "info":
    case "small_talk":
    case "out_of_scope": {
      return say(confident ? intent.choice : "clarify");
    }
    default: {
      return say("clarify");
    }
  }
}

function transfer(confident: boolean, department: ChoiceAnswer): Decision {
  if (department.choice === "none") return say("clarify_department");
  if (!confident || department.confidence < MIN_DEPARTMENT_CONFIDENCE) {
    const reply = `Would you like me to put you through to ${department.choice}?`;
    return { outcome: "confirm", action: null, reply, tool: null };
  }
  return {
    outcome: `transfer:${department.choice}`,
    action: "transfer",
    reply: `Of course, putting you through to ${department.choice} now.`,
    tool: { name: "transfer_call", args: { department: department.choice } },
  };
}

function say(branch: keyof typeof LINES): Decision {
  return { outcome: branch, action: null, reply: LINES[branch], tool: null };
}
