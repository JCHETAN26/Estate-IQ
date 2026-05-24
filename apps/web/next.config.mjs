import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Pin the workspace root so Next.js stops auto-detecting an unrelated
  // lockfile from a parent directory.
  outputFileTracingRoot: resolve(__dirname, "../.."),
  transpilePackages: ["@estate-iq/shared", "@estate-iq/analysis-engine", "@estate-iq/ui"],
  webpack: (config) => {
    // Workspace TS source uses NodeNext-style ".js" import specifiers that
    // resolve to ".ts" sources at build time. Tell webpack to try the TS
    // extensions when a ".js" specifier doesn't exist on disk.
    config.resolve.extensionAlias = {
      ".js": [".ts", ".tsx", ".js"],
      ".mjs": [".mts", ".mjs"],
    };
    return config;
  },
};

export default nextConfig;
