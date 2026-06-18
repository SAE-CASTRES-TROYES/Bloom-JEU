import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  basePath: '/jeu',
  env: {
    NEXT_PUBLIC_BASE_PATH: '/jeu',
  },
};

export default nextConfig;
