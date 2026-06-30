import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  transpilePackages: ["@adrian-zephyr-notes/markdown"],
};

export default nextConfig;
