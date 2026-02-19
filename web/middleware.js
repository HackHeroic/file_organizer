import { NextResponse } from "next/server";

const ALLOWED_ORIGIN =
  process.env.NEXT_PUBLIC_CORS_ORIGIN || "https://file-organizer.muralimadhav.com";

const corsHeaders = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
};

export function middleware(request) {
  // Handle preflight: respond to OPTIONS with 200 and CORS headers so the browser sends the real request
  if (request.method === "OPTIONS") {
    return new NextResponse(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  // For actual API requests, add CORS headers to the response (Next.js will merge with route response)
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
