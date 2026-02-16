/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
  // Non includere Playwright nel bundle server (evita chunk enormi e timeout)
  experimental: {
    serverComponentsExternalPackages: ['playwright'],
    // Body grandi per salvataggio step con screenshot (save-steps)
    serverActions: {
      bodySizeLimit: '50mb',
    },
  },
}

module.exports = nextConfig
