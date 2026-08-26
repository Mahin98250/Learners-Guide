import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { tanstackRouter as tanstackRouterPlugin } from "@tanstack/router-plugin/vite";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";

// GitHub Pages serves this repository below /Learners-Guide/, while Vercel
// serves the project from /. Keep both deployments correct from one source.
const isGitHubPagesBuild = process.env.GITHUB_ACTIONS === "true";

export default defineConfig({
  base: isGitHubPagesBuild ? "/Learners-Guide/" : "/",
  plugins: [
    tanstackRouterPlugin({ target: "react", autoCodeSplitting: true }),
    react(),
    tailwindcss(),
    tsconfigPaths(),
  ],
  build: { outDir: "dist", emptyOutDir: true },
});
