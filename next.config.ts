import type { NextConfig } from "next";
import NextPWA from "next-pwa";

const nextConfig: NextConfig = {
  output: 'export',
  reactCompiler: true,
  turbopack: {},
  images: {
    unoptimized: true,
  },
};

const withPWA = NextPWA({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
});

export default withPWA(nextConfig);
