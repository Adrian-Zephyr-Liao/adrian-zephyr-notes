import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: path.join(process.cwd(), "../.."),
  reactCompiler: true,
  images: {
    remotePatterns: [{ protocol: "https", hostname: "img.zephyrai.site" }],
  },
  transpilePackages: ["@adrian-zephyr-notes/contracts", "@adrian-zephyr-notes/markdown"],
};

export default nextConfig;
