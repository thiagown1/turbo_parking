import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow camera feed URLs from external sources
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },
};

export default nextConfig;
