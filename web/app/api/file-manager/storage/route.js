import { NextResponse } from "next/server";
import path from "path";
import fs from "fs/promises";
import { totalSize } from "../storage-util";

const WORKSPACE = process.env.WORKSPACE_PATH || path.join(process.cwd(), "workspace");
const MAX_STORAGE_BYTES = Number(process.env.MAX_STORAGE_BYTES) || 100 * 1024 * 1024; // 100 MB default

function formatBytes(bytes) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
}

export async function GET() {
  try {
    await fs.mkdir(WORKSPACE, { recursive: true });
    const { size, count } = await totalSize(WORKSPACE);
    return NextResponse.json(
      {
        used: formatBytes(size),
        usedBytes: size,
        max: formatBytes(MAX_STORAGE_BYTES),
        maxBytes: MAX_STORAGE_BYTES,
        fileCount: count,
        location: "workspace/ (server filesystem)",
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
          Pragma: "no-cache",
        },
      }
    );
  } catch (e) {
    // Fallback for hosted environments where filesystem access may be restricted
    return NextResponse.json(
      {
        used: "?",
        usedBytes: 0,
        max: MAX_STORAGE_BYTES ? `${Math.round(MAX_STORAGE_BYTES / 1024 / 1024)} MB` : "—",
        maxBytes: MAX_STORAGE_BYTES,
        fileCount: 0,
        location: "workspace/ (storage unavailable)",
        fallback: true,
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
          Pragma: "no-cache",
        },
      }
    );
  }
}
