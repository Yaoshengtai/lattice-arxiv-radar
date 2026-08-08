import type { NextConfig } from "next";

const repositoryName = "lattice-arxiv-radar";
const basePath = `/${repositoryName}`;

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  basePath,
  assetPrefix: basePath,
  images: { unoptimized: true },
};

export default nextConfig;
