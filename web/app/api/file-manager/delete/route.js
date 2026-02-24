import { NextResponse } from "next/server";
import path from "path";
import fs from "fs/promises";
import crypto from "crypto";
import { readMeta, writeMeta, removePathsFromMeta } from "../meta-util";
import { BIN_DIR, readBinMeta, writeBinMeta, ensureBin } from "../bin-util";

const WORKSPACE = process.env.WORKSPACE_PATH || path.join(process.cwd(), "workspace");

function op(id, opName, description, syscall, pathArg, path2 = null, success, error = null) {
  return { id, op: opName, description, syscall, path: pathArg, path2, success, error };
}

export async function POST(request) {
  try {
    const { path: relPath } = await request.json();
    const safePath = path.normalize(relPath).replace(/^(\.\.(\/|\\|$))+/, "");
    const fullPath = path.join(WORKSPACE, safePath);

    if (!fullPath.startsWith(WORKSPACE) || safePath === ".bin" || safePath.startsWith(".bin/")) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const stat = await fs.stat(fullPath).catch(() => null);
    if (!stat) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await ensureBin();
    const uuid = crypto.randomUUID();
    const binPath = path.join(BIN_DIR, uuid);
    await fs.rename(fullPath, binPath);

    const binMeta = await readBinMeta();
    
    let metaData = { meta: {} };
    try {
      metaData = await readMeta();
    } catch (_) {}
    const itemColor = metaData.meta?.[safePath]?.color || null;

    binMeta.items[uuid] = {
      uuid,
      originalPath: safePath,
      name: path.basename(safePath),
      type: stat.isDirectory() ? "directory" : "file",
      color: itemColor,
      deletedAt: new Date().toISOString()
    };
    await writeBinMeta(binMeta);

    let operation;
    if (stat.isDirectory()) {
      operation = op(Date.now(), "delete", "Move directory to Bin", "rename(2)", safePath, null, true);
    } else {
      operation = op(Date.now(), "delete", "Move file to Bin", "rename(2)", safePath, null, true);
    }

    // Clean up sidebar meta: remove from recents, favorites, sharedLinks
    try {
      const data = await readMeta();
      const cleaned = removePathsFromMeta(data, [safePath]);
      await writeMeta(cleaned);
    } catch (_) {}

    return NextResponse.json({ success: true, operation });
  } catch (e) {
    const operation = op(Date.now(), "delete", "Delete failed", "rename(2)", "???", null, false, e.message);
    return NextResponse.json({ success: false, error: e.message, operation }, { status: 500 });
  }
}
