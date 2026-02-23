import { NextResponse } from "next/server";
import path from "path";
import fs from "fs/promises";
import { totalSize } from "../storage-util";

const WORKSPACE = process.env.WORKSPACE_PATH || path.join(process.cwd(), "workspace");

function formatBytes(bytes) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
}

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
    if (!stat) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const name = path.basename(fullPath);
    const kind = stat.isDirectory() ? "Folder" : getKind(name);
    const created = (stat.birthtime && stat.birthtime.getTime() !== 0 ? stat.birthtime : stat.ctime).toISOString();
    const modified = stat.mtime.toISOString();

    let size = null;
    let sizeBytes = null;
    let itemCount = null;
    if (stat.isFile()) {
      size = formatBytes(stat.size);
      sizeBytes = stat.size;
    } else {
      const entries = await fs.readdir(fullPath).catch(() => []);
      itemCount = entries.length;
      const { size: dirSize } = await totalSize(fullPath).catch(() => ({ size: 0 }));
      size = formatBytes(dirSize);
      sizeBytes = dirSize;
    }

    return NextResponse.json({
      path: safePath,
      name,
      kind,
      size,
      sizeBytes,
      itemCount,
      created,
      modified,
      where: "Workspace" + (safePath ? " ▸ " + safePath.replace(/\//g, " ▸ ") : ""),
    });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

function getKind(name) {
  const ext = path.extname(name).toLowerCase();
  const map = {
    ".pdf": "PDF",
    ".txt": "Plain Text",
    ".doc": "Word",
    ".docx": "Word",
    ".xls": "Excel",
    ".xlsx": "Excel",
    ".jpg": "JPEG Image",
    ".jpeg": "JPEG Image",
    ".png": "PNG Image",
    ".gif": "GIF Image",
    ".mp3": "Audio",
    ".mp4": "Video",
  };
  return map[ext] || "Document";
}
