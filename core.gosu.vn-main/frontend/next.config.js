/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  env: {
    // Dùng relative URL /api/v1 khi có proxy (rewrites) - không cần NEXT_PUBLIC_API_URL
    NEXT_PUBLIC_USE_API_PROXY: process.env.NEXT_PUBLIC_USE_API_PROXY || 'true',
  },
  async rewrites() {
    // Proxy /api/v1 -> backend: giải quyết CORS, login từ máy khác hoạt động
    const backendUrl = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    return [
      { source: '/api/v1/:path*', destination: `${backendUrl}/api/v1/:path*` },
    ];
  },
}

module.exports = nextConfig
