const isProd = process.env.NODE_ENV === "production";
const internalHost = process.env.TAURI_DEV_HOST || "localhost";

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  distDir: "../dist",
  images: {
    // Keep static-export compatibility for desktop production builds.
    // In development we keep optimization enabled for next/image.
    unoptimized: isProd,
  },
  assetPrefix: isProd ? undefined : `http://${internalHost}:3000`,
};

export default nextConfig;
