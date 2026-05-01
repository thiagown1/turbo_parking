import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow tunnel domains for dev HMR
  allowedDevOrigins: ["*.lhr.life", "*.trycloudflare.com"],
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
