import { NextResponse } from "next/server";
import path from "path";
import fs from "fs/promises";

const WORKSPACE = process.env.WORKSPACE_PATH || path.join(process.cwd(), "workspace");

function safePath(rel) {
  return path.normalize(rel || "").replace(/^(\.\.(\/|\\|$))+/, "");
}

function fullPath(rel) {
  return path.join(WORKSPACE, safePath(rel));
}

export async function POST(request) {
  try {
    const body = await request.json();
    const items = Array.isArray(body.items)
      ? body.items
      : body.from != null && body.to != null
        ? [{ from: body.from, to: body.to }]
        : [];
    if (items.length === 0) {
      return NextResponse.json({ error: "from and to paths required" }, { status: 400 });
    }
    const operations = [];
    for (const { from: copyFrom, to: copyTo } of items) {
      if (!copyFrom || !copyTo) continue;
      const src = fullPath(copyFrom);
      const dest = fullPath(copyTo);
      if (!src.startsWith(WORKSPACE) || !dest.startsWith(WORKSPACE)) {
        return NextResponse.json({ error: "Access denied" }, { status: 403 });
      }
      const destDir = path.dirname(dest);
      await fs.mkdir(destDir, { recursive: true });
      const srcStat = await fs.stat(src);
      if (srcStat.isDirectory()) {
        await fs.cp(src, dest, { recursive: true });
      } else {
        await fs.copyFile(src, dest);
      }
      operations.push({ from: copyFrom, to: copyTo });
    }
    return NextResponse.json({
      success: true,
      action: "copy",
      operations,
      count: operations.length,
    });
  } catch (e) {
    console.error("Copy error:", e);
    return NextResponse.json({ error: e.message || "Copy failed" }, { status: 500 });
  }
}
