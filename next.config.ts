import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cache Components / partial prefetching are intentionally left off:
  // Tanda is mostly client-side, and its dynamic routes (/s/[id], /api/*)
  // are simpler to reason about with the standard request model.
  reactStrictMode: true,
  poweredByHeader: false,
};

export default nextConfig;
