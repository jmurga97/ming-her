import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import { trpc } from "~/lib/trpc";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const health = useQuery(trpc.health.queryOptions());
  return (
    <main>
      <h1>ming-her</h1>
      <p>Base del proyecto lista para construir la demo.</p>
      {health.isPending && <p role="status">Comprobando conexión…</p>}
      {health.isError && <p role="alert">No se pudo conectar con la API. Comprueba que está iniciada.</p>}
      {health.data && <p role="status">Web, API y base de datos conectadas.</p>}
    </main>
  );
}
