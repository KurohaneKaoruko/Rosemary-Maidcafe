const isProd = process.env.NODE_ENV === "production";
// Set to "true" when building for the Tauri desktop shell (static export).
// Vercel builds leave this unset so it can do an SSR/SSG build natively.
const isTauriBuild = process.env.TAURI_BUILD === "true";
const tauriDevHost = process.env.TAURI_DEV_HOST;
const isTauriDevHostMode = !isProd && isTauriBuild && Boolean(tauriDevHost);

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Tauri needs a static export so the Rust app can read files directly
  // from disk. Vercel deploys use the default SSR/SSG build.
  ...(isProd && isTauriBuild ? { output: "export" } : {}),
  // Place Next.js build artifacts inside apps/web/dist so the Tauri
  // config (`frontendDist: ../../web/dist`) can find them. When the
  // build target is Tauri, always use this directory; otherwise let
  // Vercel fall back to the default `.next` cache location.
  ...(isTauriBuild ? { distDir: "./dist" } : {}),
  images: {
    // Static export cannot use the default image optimization API.
    // In Tauri dev host mode, avoid Next image optimizer fetching local upstream URLs.
    unoptimized: isProd || isTauriDevHostMode,
  },
  assetPrefix: isTauriDevHostMode ? `http://${tauriDevHost}:3000` : undefined,
};

export default nextConfig;
