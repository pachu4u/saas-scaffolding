import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  poweredByHeader: false,
  compress: true,
  serverExternalPackages: ['pino', '@opentelemetry/sdk-node', '@prisma/client'],
  transpilePackages: [
    '@platform/auth',
    '@platform/authz',
    '@platform/billing',
    '@platform/config',
    '@platform/db',
    '@platform/jobs',
    '@platform/logger',
    '@platform/notifications',
    '@platform/observability',
    '@platform/scim',
    '@platform/tenant',
    '@platform/ui',
  ],
  // Security headers — augmented further in Phase 15
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
};

export default nextConfig;
