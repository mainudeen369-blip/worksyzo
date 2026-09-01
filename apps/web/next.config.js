/** @type {import('next').NextConfig} */
const path = require('path');

const nextConfig = {
  transpilePackages: ['@worksyzo/shared'],
  reactStrictMode: true,
  outputFileTracingRoot: path.join(__dirname, '../..'),
  async rewrites() {
    return [
      {
        source: '/avatars/worksyzo-assistant.glb',
        destination: '/avatars/worksyzo-bot.glb',
      },
      {
        source: '/avatars/worksyzo-michelle.glb',
        destination: '/avatars/worksyzo-bot.glb',
      },
    ];
  },
  async headers() {
    return [
      {
        source: '/avatars/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=0, must-revalidate' }],
      },
    ];
  },
};

module.exports = nextConfig;
