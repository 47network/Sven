/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  poweredByHeader: false,
  distDir: process.env.MISIUNI_NEXT_DIST_DIR || '.next',
  allowedDevOrigins: [
    '127.0.0.1',
    'localhost',
    'misiuni.ro',
    'misiuni.from.sven.systems',
  ],
  async rewrites() {
    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:3000';
    return [
      {
        source: '/v1/:path*',
        basePath: false,
        destination: `${apiBase}/v1/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;