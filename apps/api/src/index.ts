import { createDb } from "@ming-her/db/client";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";

import { handleChatCompletions } from "./agent/chat-completions";
import { appRouter } from "./trpc/router";

const worker = {
  // eslint-disable-next-line max-params -- Workers fetch handler signature.
  fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> | Response {
    const pathname = new URL(request.url).pathname;
    // ElevenLabs appends the path to the Server URL, with or without `/v1`.
    if (pathname.endsWith("/chat/completions")) return handleChatCompletions({ request, env, ctx });
    if (pathname !== "/trpc" && !pathname.startsWith("/trpc/")) {
      return new Response("Not found", { status: 404 });
    }
    return fetchRequestHandler({
      endpoint: "/trpc",
      req: request,
      router: appRouter,
      createContext: () => ({ db: createDb(env.DB) }),
    });
  },
} satisfies ExportedHandler<Env>;

export default worker;
