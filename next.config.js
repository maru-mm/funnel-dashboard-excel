/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
  experimental: {
    serverComponentsExternalPackages: [
      'playwright-core',
      '@sparticuz/chromium',
    ],
    serverActions: {
      bodySizeLimit: '50mb',
    },
  },
}

module.exports = nextConfig
