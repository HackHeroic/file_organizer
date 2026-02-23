import { NextResponse } from "next/server";
import { readBinMeta } from "../../bin-util";
import fs from "fs/promises";
import path from "path";
import { BIN_DIR } from "../../bin-util";

function formatBytes(bytes) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

export async function GET() {
  try {
    const meta = await readBinMeta();
    const items = [];
    
    // Check files actually still exist in .bin and get their sizes
    for (const [uuid, itemInfo] of Object.entries(meta.items)) {
      try {
        const fullPath = path.join(BIN_DIR, uuid);
        const stat = await fs.stat(fullPath);
        items.push({
          uuid: itemInfo.uuid,
          path: uuid, // Use uuid as the generic "path" for the frontend components
          name: itemInfo.name,
          originalPath: itemInfo.originalPath,
          type: itemInfo.type,
          size: stat.isDirectory() ? null : formatBytes(stat.size),
          modified: itemInfo.deletedAt, // show deleted date as modified
          deletedAt: itemInfo.deletedAt
        });
      } catch (e) {
        // If file doesn't exist anymore for some reason, we could optionally clean it up from meta
        // but skipping it for the response is fine.
      }
    }

    // Sort by most recently deleted first
    items.sort((a, b) => new Date(b.deletedAt) - new Date(a.deletedAt));

    return NextResponse.json({ items });
  } catch (error) {
    return NextResponse.json({ items: [], error: error.message }, { status: 500 });
  }
}
