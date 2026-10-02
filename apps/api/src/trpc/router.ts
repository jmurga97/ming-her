import { initTRPC, TRPCError } from "@trpc/server";
import { sql } from "drizzle-orm";

import type { DrizzleDb } from "@ming-her/db/client";

const t = initTRPC.context<{ db: DrizzleDb }>().create();

export const appRouter = t.router({
  health: t.procedure.query(async ({ ctx }) => {
    const result = await ctx.db.get<{ ok: number }>(sql`SELECT 1 AS ok`);
    if (result?.ok !== 1) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "D1 check failed" });
    return { status: "ok" as const, database: "connected" as const };
  }),
});

export type AppRouter = typeof appRouter;
