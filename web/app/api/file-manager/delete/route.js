import { NextResponse } from "next/server";
import path from "path";
import fs from "fs/promises";
import { readMeta, writeMeta, removePathsFromMeta } from "../meta-util";

const WORKSPACE = path.join(process.cwd(), "workspace");

function op(id, opName, description, syscall, pathArg, path2 = null, success, error = null) {
  return { id, op: opName, description, syscall, path: pathArg, path2, success, error };
}

export async function POST(request) {
  try {
    const { path: relPath } = await request.json();
    const safePath = path.normalize(relPath).replace(/^(\.\.(\/|\\|$))+/, "");
    const fullPath = path.join(WORKSPACE, safePath);

    if (!fullPath.startsWith(WORKSPACE)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const stat = await fs.stat(fullPath).catch(() => null);
    if (!stat) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    let operation;
    if (stat.isDirectory()) {
      await fs.rm(fullPath, { recursive: true, force: true });
      operation = op(Date.now(), "delete", "Delete directory", "rmdir(2)/unlinkat(2)", safePath, null, true);
    } else {
      await fs.unlink(fullPath);
      operation = op(Date.now(), "delete", "Delete file", "unlink(2)", safePath, null, true);
    }

    // Clean up sidebar meta: remove from recents, favorites, sharedLinks
    try {
      const data = await readMeta();
      const cleaned = removePathsFromMeta(data, [safePath]);
      await writeMeta(cleaned);
    } catch (_) {}

    return NextResponse.json({ success: true, operation });
  } catch (e) {
    const operation = op(Date.now(), "delete", "Delete failed", "unlink(2)", "???", null, false, e.message);
    return NextResponse.json({ success: false, error: e.message, operation }, { status: 500 });
  }
}
