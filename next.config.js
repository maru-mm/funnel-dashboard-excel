/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // 'standalone' is only needed for Docker/Fly.io self-hosting.
  // On Vercel, omit it so Fluid Compute and maxDuration work correctly.
  ...(process.env.STANDALONE === 'true' ? { output: 'standalone' } : {}),
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
