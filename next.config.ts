import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emits `.next/standalone` — the server plus only the traced node_modules —
  // which is what the Docker runtime stage copies. Harmless outside Docker.
  output: "standalone",
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "cdn.intra.42.fr",
      },
    ],
  },
};

export default nextConfig;
