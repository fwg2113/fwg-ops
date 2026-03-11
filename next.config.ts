import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    turbopackUseSystemTlsCerts: true,
    serverActions: {
      bodySizeLimit: '25mb',
    },
  },
  transpilePackages: ['@twilio/voice-sdk'],
  async headers() {
    return [
      {
        source: '/api/image-enhancer/:path*',
        headers: [
          {
            key: 'x-middleware-prefetch',
            value: '',
          },
        ],
      },
    ]
  },
};

export default nextConfig;
