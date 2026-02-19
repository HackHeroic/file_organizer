import { NextResponse } from "next/server";

// Build allowed origins: env var (comma-separated) + defaults
const ENV_ORIGINS = (process.env.CORS_ALLOWED_ORIGINS || process.env.NEXT_PUBLIC_CORS_ORIGIN || "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

const DEFAULT_ORIGINS = [
  "https://file-organizer.muralimadhav.com",
  "http://localhost:3000",
  /^https:\/\/[\w.-]+\.pages\.dev$/,  // Any Cloudflare Pages URL (production + preview)
];

const ALLOWED_ORIGINS = [...ENV_ORIGINS, ...DEFAULT_ORIGINS];

function originAllowed(origin) {
  if (!origin) return false;
  return ALLOWED_ORIGINS.some((allowed) =>
    typeof allowed === "string" ? allowed === origin : allowed.test?.(origin)
  );
}

function getCorsHeaders(origin) {
  const allowOrigin = origin && originAllowed(origin) ? origin : "https://file-organizer.muralimadhav.com";
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
  };
}

export function middleware(request) {
  const origin = request.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  // Handle preflight: respond to OPTIONS with 204 and CORS headers so the browser sends the real request
  if (request.method === "OPTIONS") {
    return new NextResponse(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  // For actual API requests, add CORS headers to the response
  if (request.nextUrl.pathname.startsWith("/api/")) {
    const response = NextResponse.next();
    Object.entries(corsHeaders).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/api/:path*",
};
