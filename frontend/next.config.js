/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  // experimental: {
  //   outputFileTracingRoot: undefined, // 移除不支持的配置
  // },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: process.env.NODE_ENV === 'production'
          ? 'http://backend:3002/api/:path*'
          : 'http://localhost:3002/api/:path*',
      },
    ];
  },
};

module.exports = nextConfig;
