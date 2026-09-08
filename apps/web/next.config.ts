import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@dojo/core"],
  serverExternalPackages: [],
};

export default nextConfig;
