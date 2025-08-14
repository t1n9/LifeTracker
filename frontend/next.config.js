/** @type {import('next').NextConfig} */
const nextConfig = {
  // 使用 Node 服务器渲染；提供 standalone 产物，便于服务器运行
  output: 'standalone',
  // 如需静态导出，可在明确可行时设置环境变量 STATIC_EXPORT=true
  ...(process.env.STATIC_EXPORT === 'true' && {
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
