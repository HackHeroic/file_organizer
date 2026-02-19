import { NextResponse } from "next/server";
import path from "path";
import fs from "fs/promises";
import { readMeta, writeMeta, removePathsFromMeta } from "../meta-util";

const WORKSPACE = path.join(process.cwd(), "workspace");

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

    for (const relPath of paths) {
      const safePath = path.normalize(relPath).replace(/^(\.\.(\/|\\|$))+/, "");
      const fullPath = path.join(WORKSPACE, safePath);

      if (!fullPath.startsWith(WORKSPACE)) {
        operations.push(op(++id, "delete", "Access denied", "unlink(2)", safePath, null, false, "Access denied"));
        continue;
      }

      try {
        const stat = await fs.stat(fullPath);
        if (stat.isDirectory()) {
          await fs.rm(fullPath, { recursive: true, force: true });
          operations.push(op(++id, "delete", "Delete directory", "rmdir(2)/unlinkat(2)", safePath, null, true, null));
        } else {
          await fs.unlink(fullPath);
          operations.push(op(++id, "delete", "Delete file", "unlink(2)", safePath, null, true, null));
        }
      } catch (e) {
        operations.push(op(++id, "delete", "Delete failed", "unlink(2)", safePath, null, false, e.message));
      }
    }

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
