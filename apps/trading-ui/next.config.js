/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  basePath: process.env.TRADING_BASE_PATH || '',
  distDir: process.env.TRADING_NEXT_DIST_DIR || '.next',
  allowedDevOrigins: [
    '127.0.0.1',
    'localhost',
    'trading.sven.systems',
    'sven.systems',
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
