import assert from "node:assert/strict";

import { createTRPCClient, httpBatchLink } from "@trpc/client";

import type { AppRouter } from "@ming-her/api/router";

const client = createTRPCClient<AppRouter>({
  links: [httpBatchLink({ url: "http://127.0.0.1:5180/trpc" })],
});
assert.deepEqual(await client.health.query(), { status: "ok", database: "connected" });
const missing = await fetch("http://127.0.0.1:8791/missing");
assert.equal(missing.status, 404);
console.log("Web proxy → tRPC → Drizzle → local D1: OK");
