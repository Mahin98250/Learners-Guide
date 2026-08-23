import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { tanstackRouter as tanstackRouterPlugin } from "@tanstack/router-plugin/vite";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  // Vercel serves the application from the project root. Keep the production
  // base root-relative so assets and the router resolve correctly there.
  base: "/",
  plugins: [
    // TanStack Router's file-based route plugin must run before React.
    tanstackRouterPlugin({
      target: "react",
      autoCodeSplitting: true,
    }),
    react(),
    tailwindcss(),
    tsconfigPaths(),
  ],
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
