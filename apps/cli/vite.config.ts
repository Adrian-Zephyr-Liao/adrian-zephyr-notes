import { defineConfig } from "vite-plus";

// Created with vp create vite:library; vp pack produces the installable CLI.
export default defineConfig({
  pack: {
    entry: { azn: "src/main.ts" },
    format: ["esm"],
    platform: "node",
    target: "node22",
    dts: false,
    sourcemap: true,
    deps: { alwaysBundle: [/.*/], onlyBundle: false },
  },
});
