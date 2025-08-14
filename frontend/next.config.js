/** @type {import('next').NextConfig} */
const nextConfig = {
  // 只在生产构建时使用静态导出
  ...(process.env.NODE_ENV !== 'development' && {
    output: 'export',
    trailingSlash: true,
  }),
  images: {
    unoptimized: true
  },
  eslint: {
    // 在生产构建时忽略ESLint错误
    ignoreDuringBuilds: true,
  },
  typescript: {
    // 在生产构建时忽略TypeScript错误
    ignoreBuildErrors: true,
  },
  // 开发环境使用rewrites进行API代理
  async rewrites() {
    if (process.env.NODE_ENV === 'development') {
      return [
        {
          source: '/api/:path*',
          destination: 'http://localhost:3002/api/:path*',
        },
      ];
    }
    return [];
  },
};

module.exports = nextConfig;
