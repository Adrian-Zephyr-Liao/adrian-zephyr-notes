import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";
import viteReact from "@vitejs/plugin-react";

const config = defineConfig({
  build: {
    chunkSizeWarningLimit: 800,
    rolldownOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules") && !id.includes("/packages/markdown/")) {
            return undefined;
          }

          if (id.includes("/react/") || id.includes("/react-dom/") || id.includes("/scheduler/")) {
            return "vendor-react";
          }

          if (id.includes("/@tanstack/")) {
            return "vendor-tanstack";
          }

          if (
            id.includes("/@adrian-zephyr-notes/markdown/") ||
            id.includes("/packages/markdown/") ||
            id.includes("/react-markdown/") ||
            id.includes("/remark-") ||
            id.includes("/rehype-") ||
            id.includes("/unified/") ||
            id.includes("/unist-") ||
            id.includes("/mdast-") ||
            id.includes("/hast-")
          ) {
            return "vendor-markdown";
          }

          if (id.includes("/shiki/") || id.includes("/@shikijs/core/")) {
            return "vendor-shiki";
          }

          if (id.includes("/lucide-react/")) {
            return "vendor-icons";
          }

          return undefined;
        },
      },
    },
  },
  resolve: { tsconfigPaths: true },
  plugins: [tailwindcss(), devtools(), viteReact()],
});

export default config;
