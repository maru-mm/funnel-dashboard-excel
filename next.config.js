/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  // Non includere Playwright nel bundle server (evita chunk enormi e timeout)
  experimental: {
    serverComponentsExternalPackages: ['playwright'],
  },
}

module.exports = nextConfig
