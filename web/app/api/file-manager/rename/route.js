import { NextResponse } from "next/server";
import path from "path";
import fs from "fs/promises";

const WORKSPACE = process.env.WORKSPACE_PATH || path.join(process.cwd(), "workspace");

function op(id, opName, description, syscall, pathArg, path2 = null, success, error = null) {
  return { id, op: opName, description, syscall, path: pathArg, path2, success, error };
}

export async function POST(request) {
  try {
    const { path: relPath, newName } = await request.json();
    if (!newName || !/^[^/\\<>:"|?*]+$/.test(newName)) {
      return NextResponse.json({ error: "Invalid name" }, { status: 400 });
    }

    const safePath = path.normalize(relPath).replace(/^(\.\.(\/|\\|$))+/, "");
    const oldPath = path.join(WORKSPACE, safePath);
    const dir = path.dirname(oldPath);
    const newPath = path.join(dir, newName);
    const relNewPath = path.join(path.dirname(safePath), newName).replace(/\\/g, "/");

    if (!oldPath.startsWith(WORKSPACE) || !newPath.startsWith(WORKSPACE)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    try {
      await fs.rename(oldPath, newPath);
      const operation = op(Date.now(), "rename", "Rename file/folder", "rename(2)", safePath, relNewPath, true);
      return NextResponse.json({ success: true, operation });
    } catch (e) {
      const operation = op(Date.now(), "rename", "Rename file/folder", "rename(2)", safePath, relNewPath, false, e.message);
      return NextResponse.json({ success: false, error: e.message, operation }, { status: 500 });
    }
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
