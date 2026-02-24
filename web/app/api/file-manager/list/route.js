import { NextResponse } from "next/server";
import path from "path";
import fs from "fs/promises";
import { totalSize } from "../storage-util";
import { readMeta } from "../meta-util";

const WORKSPACE = process.env.WORKSPACE_PATH || path.join(process.cwd(), "workspace");

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const relPath = searchParams.get("path") || "";
    const safePath = path.normalize(relPath).replace(/^(\.\.(\/|\\|$))+/, "");
    const fullPath = path.join(WORKSPACE, safePath);

    if (!fullPath.startsWith(WORKSPACE)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const stat = await fs.stat(fullPath).catch(() => null);
    if (!stat || !stat.isDirectory()) {
      return NextResponse.json({ error: "Not a directory" }, { status: 400 });
    }

    const entries = await fs.readdir(fullPath, { withFileTypes: true });
    const items = [];
    
    const metaData = await readMeta().catch(() => ({}));
    const metaInfo = metaData.meta || {};

    for (const ent of entries) {
      if (ent.name.startsWith(".")) continue;
      const itemPath = path.join(fullPath, ent.name);
      const relItemPath = path.join(safePath, ent.name).replace(/\\/g, "/");
      const itemStat = await fs.stat(itemPath).catch(() => null);
      
      const item = {
        name: ent.name,
        path: relItemPath,
        type: ent.isDirectory() ? "directory" : "file",
        color: metaInfo[relItemPath]?.color || null,
      };

      if (itemStat) {
        if (ent.isDirectory()) {
          const { size: dirSize } = await totalSize(itemPath).catch(() => ({ size: 0 }));
          item.size = formatBytes(dirSize);
          item.sizeBytes = dirSize;
          const children = await fs.readdir(itemPath).catch(() => []);
          item.childrenCount = children.length;
        } else {
          item.size = formatBytes(itemStat.size);
          item.sizeBytes = itemStat.size;
        }
        item.modified = itemStat.mtime.toISOString();
        item.created = (itemStat.birthtime && itemStat.birthtime.getTime() !== 0 ? itemStat.birthtime : itemStat.ctime).toISOString();
      }

      items.push(item);
    }

    items.sort((a, b) => {
      if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    return NextResponse.json({ items });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

function formatBytes(bytes) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + " " + sizes[i];
}
