import { createFileRoute } from "@tanstack/react-router";
import PlatformOwnerPortal from "@/platform/PlatformOwnerPortal";

export const Route = createFileRoute("/owner")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Platform Owner — Control Center" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: PlatformOwnerPortal,
});
