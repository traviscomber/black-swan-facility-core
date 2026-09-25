/** @type {import('next').NextConfig} */
const nextConfig = {
  productionBrowserSourceMaps: false,
  serverExternalPackages: ["xlsx"],
  experimental: {
    serverSourceMaps: false,
    staticGenerationMaxConcurrency: 1,
    staticGenerationMinPagesPerWorker: 100,
  },
  images: {
    unoptimized: true,
  },
  async headers() {
    const loginCacheHeaders = [
      { key: "Cache-Control", value: "public, max-age=0, must-revalidate" },
      { key: "Vercel-CDN-Cache-Control", value: "public, s-maxage=86400, stale-while-revalidate=604800" },
    ]

    return [
      { source: "/auth/login", headers: loginCacheHeaders },
      { source: "/en/auth/login", headers: loginCacheHeaders },
      { source: "/es/auth/login", headers: loginCacheHeaders },
      { source: "/de/auth/login", headers: loginCacheHeaders },
    ]
  },
  skipTrailingSlashRedirect: true,
  staticPageGenerationTimeout: 30,
  onDemandEntries: {
    maxInactiveAge: 25 * 1000,
    pagesBufferLength: 5,
  },
}

export default nextConfig
