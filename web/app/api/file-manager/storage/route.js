import { NextResponse } from "next/server";
import path from "path";
import fs from "fs/promises";

const WORKSPACE = path.join(process.cwd(), "workspace");

async function totalSize(dirPath) {
  let size = 0;
  let count = 0;
  const entries = await fs.readdir(dirPath, { withFileTypes: true }).catch(() => []);
  for (const ent of entries) {
    if (ent.name.startsWith(".")) continue;
    const full = path.join(dirPath, ent.name);
    if (ent.isDirectory()) {
      const sub = await totalSize(full);
      size += sub.size;
      count += sub.count;
    } else {
      const stat = await fs.stat(full).catch(() => null);
      if (stat) {
        size += stat.size;
        count += 1;
      }
    }
  }
  return { size, count };
}

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
    return NextResponse.json({
      used: formatBytes(size),
      usedBytes: size,
      fileCount: count,
      location: "workspace/ (server filesystem)",
    });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
