# ming-her

Bun 1.4.0 + Turbo monorepo. Web: React/Vite/TanStack Router. API: Worker/tRPC. Database: Drizzle/D1.

- Keep this scaffold minimal. Do not add authentication, permissions or demo features without a request.
- Run `bun install`, `bun run build`, `bun run check` and `bun run lint` after changes.
- With development servers running, `bun run smoke` verifies web proxy → API → Drizzle → D1.
- Preserve the Qmenut lint and formatting rules. Use type-only imports, early returns and architecture boundaries.
- `apps/web/src/app/routes` owns file routes; never edit `route-tree.gen.ts` manually.
- `packages/db/src/schema/index.ts` is the schema entry point. Generate migrations with `bun run db:generate --name <name>`.
- Apply migrations only locally with `bun run db:migrate:local`; commit SQL and Drizzle metadata together.
- Do not add external integrations, deployment scripts or a test framework for future needs.

<!-- BEGIN:turborepo-agent-rules -->

# This is NOT the Turborepo you know

Turborepo configuration, task behavior, and CLI commands can vary between installed versions and may differ from your training data. Resolve the `turbo` package from this file's directory or relevant workspace; in monorepos, it may not be visible from the repository root. For example, run `node -p "require.resolve('turbo/package.json')"` from a workspace that depends on `turbo`.

Read `docs/README.md` inside that installed package first, then read the relevant pages from its `docs/` directory before changing Turborepo configuration or commands. Heed deprecation notices. These bundled docs match the installed package version and are available without network access.

This block is written and re-added by `turbo` before repository-scoped commands when an AI agent is detected. In the Turborepo source repository, its template is defined in `crates/turborepo-cli/src/cli/agent_guidance.rs`. Removing the managed block while updates are enabled means a later qualifying invocation will add it again. Set `"agentGuidance": false` in the root `turbo.json` or `turbo.jsonc` to opt out; this does not remove an existing block. Keep the block committed with your work to avoid an uncommitted change on the next agent invocation.
<!-- END:turborepo-agent-rules -->
