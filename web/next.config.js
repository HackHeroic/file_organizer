/** @type {import('next').NextConfig} */
const nextConfig = {
  // Static export only when building for Cloudflare Pages (frontend). Render backend uses default build.
  ...(process.env.CF_PAGES === "1" ? { output: "export" } : {}),
};

module.exports = nextConfig;
