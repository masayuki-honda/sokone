import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["sharp"],
  experimental: {
    serverBodySizeLimit: "50mb",
  },
};

export default nextConfig;
