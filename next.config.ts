import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Static export for Firebase Hosting (no SSR)
  output: 'export',
  images: { unoptimized: true },
  typescript: {
    // Temporarily ignore type errors during build to unblock deploys
    // Use `npm run typecheck` to catch issues locally/CI
    ignoreBuildErrors: true,
  },
  eslint: {
    // Lint in CI/dev, but don't block production builds yet
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
