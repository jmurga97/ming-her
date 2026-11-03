import { createFileRoute } from "@tanstack/react-router";

import { InspectorPage } from "~/features/turn-inspector/inspector-page";

export const Route = createFileRoute("/")({ component: InspectorPage });
