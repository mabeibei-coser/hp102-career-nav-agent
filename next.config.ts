import type { NextConfig } from "next";

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || "";

const nextConfig: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR || ".next",
  basePath: BASE_PATH,
  assetPrefix: BASE_PATH,
  serverExternalPackages: [
    "better-sqlite3",
    "pdf-parse",
    "mammoth",
    "puppeteer",
    "puppeteer-core",
  ],
};

export default nextConfig;
