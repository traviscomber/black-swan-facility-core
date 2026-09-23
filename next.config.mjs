/** @type {import('next').NextConfig} */
const nextConfig = {
  productionBrowserSourceMaps: false,
  serverExternalPackages: ["xlsx"],
  experimental: {
    serverSourceMaps: false,
    webpackBuildWorker: true,
  },
  images: {
    unoptimized: true,
  },
  skipTrailingSlashRedirect: true,
  staticPageGenerationTimeout: 30,
  onDemandEntries: {
    maxInactiveAge: 25 * 1000,
    pagesBufferLength: 5,
  },
}

export default nextConfig
