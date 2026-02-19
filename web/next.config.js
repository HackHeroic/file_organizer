/** @type {import('next').NextConfig} */
const nextConfig = {
  // Static export only when building for Cloudflare Pages (frontend). Render backend uses default build.
  ...(process.env.CF_PAGES === "1" ? { output: "export" } : {}),
  async headers() {
    return [
      {
        source: "/api/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "https://file-organizer.muralimadhav.com" },
          { key: "Access-Control-Allow-Methods", value: "GET, POST, PUT, DELETE, OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "Content-Type, Authorization" },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
