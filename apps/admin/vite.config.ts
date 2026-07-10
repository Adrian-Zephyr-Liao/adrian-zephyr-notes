import { defineConfig, loadEnv } from "vite";
import tailwindcss from "@tailwindcss/vite";
import viteReact from "@vitejs/plugin-react";

const DEFAULT_BACKEND_API_BASE_URL = "http://127.0.0.1:3001";

const config = defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const backendApiProxyTarget = (
    env.VITE_BACKEND_PROXY_TARGET ?? DEFAULT_BACKEND_API_BASE_URL
  ).replace(/\/$/, "");

  return {
    build: {
      chunkSizeWarningLimit: 800,
      rolldownOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes("node_modules") && !id.includes("/packages/markdown/")) {
              return undefined;
            }

            if (
              id.includes("/react/") ||
              id.includes("/react-dom/") ||
              id.includes("/scheduler/")
            ) {
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
    plugins: [tailwindcss(), viteReact()],
    server: {
      allowedHosts: [".ngrok-free.app"],
      proxy: {
        "/api": {
          changeOrigin: true,
          secure: false,
          target: backendApiProxyTarget,
        },
      },
    },
  };
});

export default config;
