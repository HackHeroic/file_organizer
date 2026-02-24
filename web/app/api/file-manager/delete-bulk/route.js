import { NextResponse } from "next/server";
import path from "path";
import fs from "fs/promises";
import crypto from "crypto";
import { readMeta, writeMeta, removePathsFromMeta } from "../meta-util";
import { BIN_DIR, readBinMeta, writeBinMeta, ensureBin } from "../bin-util";

const WORKSPACE = process.env.WORKSPACE_PATH || path.join(process.cwd(), "workspace");

function op(id, opName, description, syscall, pathArg, path2, success, error) {
  return { id, op: opName, description, syscall, path: pathArg, path2, success, error };
}

export async function POST(request) {
  try {
    const { paths } = await request.json();
    if (!Array.isArray(paths) || paths.length === 0) {
      return NextResponse.json({ error: "paths array required" }, { status: 400 });
    }

    const operations = [];
    let id = Date.now();

    await ensureBin();
    const binMeta = await readBinMeta();
    
    let metaData = { meta: {} };
    try {
      metaData = await readMeta();
    } catch (_) {}

    for (const relPath of paths) {
      const safePath = path.normalize(relPath).replace(/^(\.\.(\/|\\|$))+/, "");
      const fullPath = path.join(WORKSPACE, safePath);

      if (!fullPath.startsWith(WORKSPACE) || safePath === ".bin" || safePath.startsWith(".bin/")) {
        operations.push(op(++id, "delete", "Access denied", "rename(2)", safePath, null, false, "Access denied"));
        continue;
      }

      try {
        const stat = await fs.stat(fullPath);
        const uuid = crypto.randomUUID();
        const binPath = path.join(BIN_DIR, uuid);
        await fs.rename(fullPath, binPath);

        const itemColor = metaData.meta?.[safePath]?.color || null;

        binMeta.items[uuid] = {
          uuid,
          originalPath: safePath,
          name: path.basename(safePath),
          type: stat.isDirectory() ? "directory" : "file",
          color: itemColor,
          deletedAt: new Date().toISOString()
        };

        if (stat.isDirectory()) {
          operations.push(op(++id, "delete", "Move directory to Bin", "rename(2)", safePath, null, true, null));
        } else {
          operations.push(op(++id, "delete", "Move file to Bin", "rename(2)", safePath, null, true, null));
        }
      } catch (e) {
        operations.push(op(++id, "delete", "Delete failed", "rename(2)", safePath, null, false, e.message));
      }
    }

    await writeBinMeta(binMeta);

    // Clean up sidebar meta for successfully deleted paths
    const deletedPaths = operations.filter((o) => o.success).map((o) => o.path);
    if (deletedPaths.length > 0) {
      try {
        const data = await readMeta();
        const cleaned = removePathsFromMeta(data, deletedPaths);
        await writeMeta(cleaned);
      } catch (_) {}
    }

    return NextResponse.json({ success: true, operations });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
