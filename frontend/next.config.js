/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  experimental: {
    outputFileTracingRoot: undefined,
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://backend:3002/api/:path*',
      },
    ];
  },
};

module.exports = nextConfig;
