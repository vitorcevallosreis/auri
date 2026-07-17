import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // Gera .next/standalone com um server.js auto-contido (só as deps realmente
  // alcançadas pelo trace), para rodar no container com `node server.js` — sem
  // node_modules completo e sem `next start`.
  output: "standalone",
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
