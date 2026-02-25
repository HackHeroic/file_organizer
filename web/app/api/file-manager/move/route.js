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
    for (const { from: moveFrom, to: moveTo } of items) {
      if (!moveFrom || !moveTo) continue;
      const src = fullPath(moveFrom);
      const dest = fullPath(moveTo);
      if (!src.startsWith(WORKSPACE) || !dest.startsWith(WORKSPACE)) {
        return NextResponse.json({ error: "Access denied" }, { status: 403 });
      }
      const destDir = path.dirname(dest);
      await fs.mkdir(destDir, { recursive: true });
      await fs.rename(src, dest);
      operations.push({ from: moveFrom, to: moveTo });
    }
    return NextResponse.json({
      success: true,
      action: "move",
      operations,
      count: operations.length,
    });
  } catch (e) {
    console.error("Move error:", e);
    return NextResponse.json({ error: e.message || "Move failed" }, { status: 500 });
  }
}
