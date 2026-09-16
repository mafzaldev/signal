import type { NextConfig } from 'next';

const apiUrl = process.env.API_URL ?? 'http://localhost:4000';

const nextConfig: NextConfig = {
  agentRules: false,
  turbopack: {
    rules: {
      '*.css': {
        loaders: ['@tailwindcss/turbopack'],
        as: '*.css',
      },
    },
  },
  // Auth requests go through the dashboard's own origin, so the session cookie
  // is first-party and server components can forward it to the API.
  async rewrites() {
    return [{ source: '/api/auth/:path*', destination: `${apiUrl}/api/auth/:path*` }];
  },
};

export default nextConfig;
