# ming-her

Scaffolding local para la futura demo, basado en el monorepo de Qmenut.

## Arrancar

Requisitos: Bun 1.4.0 y Node.js 24 LTS (Wrangler).

```sh
bun install
bun run dev
```

Abre http://127.0.0.1:5180. La página comprueba la conexión completa con la API y D1 mediante tRPC y Drizzle.
La API se ejecuta en http://127.0.0.1:8791; Vite redirige `/trpc` hacia ella. Se usan puertos diferentes a Qmenut.
No hacen falta cuenta de Cloudflare, credenciales, autenticación ni servicios externos.

## Estructura

- `apps/web`: React 19 + Vite, rutas por archivos con TanStack Router y consultas con TanStack Query + tRPC.
- `apps/api`: Cloudflare Worker local, API tRPC pública y binding D1 `DB`.
- `packages/db`: cliente Drizzle y directorio de esquemas compartidos.
- `apps/web/scripts/smoke.ts`: comprobación de la conexión a través del proxy web.

El contrato de la API se comparte por tipos mediante `@ming-her/api/router`. No se incluye código del servidor en el navegador.
La web tiene la base SPA del admin de Qmenut; no incluye todavía pantallas de la demo ni paquetes de autenticación o permisos.

## Bloque de decisiones (fase 1)

`POST /v1/chat/completions` es el "Custom LLM" del agente de ElevenLabs. No hay ningún LLM: Jev (`jev-1.13.0`) juzga la intención, el departamento, si hay inyección y el nivel de frustración. Después `apps/api/src/agent/policy.ts` aplica los umbrales y elige una línea fija o un tool call (`transfer_call`, `end_call`). Cada turno queda guardado en la tabla `turns` de D1; los contadores son `SELECT action, COUNT(*) FROM turns GROUP BY action`.

Crea `apps/api/.dev.vars` con `JEV_API_KEY=...` y `LLM_SECRET=...`, que es el secreto que ElevenLabs enviará como API key. Después:

```sh
bun run --cwd apps/api check:policy   # política sin red
bun run --cwd apps/api scenarios      # escenarios contra Jev; requiere bun run dev
```

## Crear el primer esquema

El esquema empieza vacío. Añade las tablas SQLite en `packages/db/src/schema/` y expórtalas desde `index.ts`.
Después ejecuta:

```sh
bun run db:generate --name initial
bun run db:migrate:local
```

Drizzle Kit genera SQL y metadatos en `apps/api/migrations/`; conserva ambos en Git.
Wrangler aplica las migraciones a D1 local. No edites migraciones ya aplicadas ni uses `drizzle-kit push`.
D1 persiste los datos en `apps/api/.wrangler/state/`, ignorado en Git.
El identificador D1 de `wrangler.jsonc` es un marcador local: sustituirlo y configurar el despliegue corresponde a una etapa posterior.

## Comprobaciones

```sh
bun run build
bun run check
bun run lint
bun run smoke # Con bun run dev ejecutándose en otra terminal
```

`check` genera antes los tipos del Worker y el árbol de rutas para funcionar desde una instalación limpia.

## Formato y linter

Se reutilizan sin cambios las reglas de `.oxlintrc.jsonc` y `.oxfmtrc.jsonc` de Qmenut.
Qmenut actualmente usa Oxlint con tipos y reglas de arquitectura, y Oxfmt para TypeScript, React y JSON.
`prettier.config.js` mantiene sus opciones: 2 espacios, comillas dobles, punto y coma, comas finales y ancho 120.
Se omite el plugin de Astro porque este proyecto no tiene una landing Astro.

```sh
bun run format
bun run format:check
```

## Referencias

- [tRPC: adaptador Fetch para Workers](https://trpc.io/docs/server/adapters/fetch)
- [TanStack Router con Vite](https://tanstack.com/router/latest/docs/framework/react/installation/with-vite)
- [Drizzle con D1](https://orm.drizzle.team/docs/get-started/d1-new)
- [D1: desarrollo local](https://developers.cloudflare.com/d1/best-practices/local-development/)
