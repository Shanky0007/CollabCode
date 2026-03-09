import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Turbopack is default in Next.js 16.
  // Monaco, xterm, and Yjs are guarded by dynamic({ ssr: false }) — no extra config needed.
  turbopack: {
    root: __dirname, // prevent workspace root detection warning from monorepo lockfiles
  },
};

export default nextConfig;
