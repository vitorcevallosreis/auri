import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  pageExtensions: ["jsx", "js", "tsx", "ts"],
  experimental: {},
  compiler: {
    styledComponents: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: { unoptimized: true },
  typescript: {
    ignoreBuildErrors: true,
  },
}

export default nextConfig
