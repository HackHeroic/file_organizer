/** Base URL for API when frontend is served separately (e.g. Cloudflare Pages). */
export const API_BASE =
  typeof window !== "undefined" ? (process.env.NEXT_PUBLIC_API_URL || "") : "";
