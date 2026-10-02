import { fileURLToPath } from "node:url";

import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    tanstackRouter({
      generatedRouteTree: "./src/app/route-tree.gen.ts",
      routesDirectory: "./src/app/routes",
      target: "react",
      autoCodeSplitting: true,
    }),
    react(),
  ],
  resolve: { alias: { "~": fileURLToPath(new URL("./src", import.meta.url)) } },
  server: { proxy: { "/trpc": "http://127.0.0.1:8791" } },
});
