/** @type {import('next').NextConfig} */
const path = require('path');

const nextConfig = {
  transpilePackages: ['@worksyzo/shared'],
  reactStrictMode: true,
  outputFileTracingRoot: path.join(__dirname, '../..'),
};

module.exports = nextConfig;
