import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    turbopackUseSystemTlsCerts: true,
  },
  transpilePackages: ['@twilio/voice-sdk'],
};

export default nextConfig;
