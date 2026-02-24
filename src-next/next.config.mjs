const isProd = process.env.NODE_ENV === "production";
const tauriDevHost = process.env.TAURI_DEV_HOST;
const isTauriDevHostMode = !isProd && Boolean(tauriDevHost);

/** @type {import('next').NextConfig} */
const nextConfig = {
  ...(isProd ? { output: "export" } : {}),
  distDir: "../dist",
  images: {
    // Static export cannot use the default image optimization API.
    // In Tauri dev host mode, avoid Next image optimizer fetching local upstream URLs.
    unoptimized: isProd || isTauriDevHostMode,
  },
  assetPrefix: isTauriDevHostMode ? `http://${tauriDevHost}:3000` : undefined,
};

export default nextConfig;
