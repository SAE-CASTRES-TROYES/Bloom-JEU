import type { NextConfig } from "next";
const basePath = process.env.NEXT_BASE_PATH ?? ''
const nextConfig: NextConfig = {
  basePath,
  images: {
    loader: 'custom',
    loaderFile: './image-loader.ts',
  },
};
export default nextConfig;
