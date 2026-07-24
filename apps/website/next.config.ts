import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: path.join(process.cwd(), "../.."),
  reactCompiler: true,
  transpilePackages: ["@adrian-zephyr-notes/contracts", "@adrian-zephyr-notes/markdown"],
};

export default nextConfig;
