import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheHandler: require.resolve("./src/lib/cache-handler.js"),
  cacheMaxMemorySize: 0, // Disable in-memory cache, use Redis only
};

export default nextConfig;
