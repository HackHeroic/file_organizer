import SharedPageClient from "./SharedPageClient";

// One placeholder path for static export; client handles any token from URL.
export function generateStaticParams() {
  return [{ token: "shared" }];
}

export default function SharedPage() {
  return <SharedPageClient />;
}
