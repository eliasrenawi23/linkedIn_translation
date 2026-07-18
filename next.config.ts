import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    // next.config.ts is transpiled before evaluation, so __dirname can point at
    // the parent folder. Next commands run from this package's directory.
    root: process.cwd(),
  },
};

export default nextConfig;
