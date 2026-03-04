import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["sharp"],
  // Increase body size limit for multi-image uploads (default: 10MB)
  // proxyClientMaxBodySize is the Next.js 16 key; not yet reflected in public NextConfig type
  proxyClientMaxBodySize: "50mb",
} as NextConfig & Record<string, unknown>;

export default nextConfig;
