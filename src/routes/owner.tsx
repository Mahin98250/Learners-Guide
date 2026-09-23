import { createFileRoute } from "@tanstack/react-router";
import PlatformOwnerControlPlane from "@/platform/PlatformOwnerControlPlane";

export const Route = createFileRoute("/owner")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Platform Owner — Control Center" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: PlatformOwnerControlPlane,
});
