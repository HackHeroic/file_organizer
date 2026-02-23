import { NextResponse } from "next/server";
import path from "path";
import fs from "fs/promises";

async function pathExists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

const WORKSPACE = process.env.WORKSPACE_PATH || path.join(process.cwd(), "workspace");

function op(id, opName, description, syscall, pathArg, path2 = null, success, error = null) {
  return { id, op: opName, description, syscall, path: pathArg, path2, success, error };
}

export async function POST(request) {
  try {
    const { path: relPath, name } = await request.json();
    if (!name || !/^[^/\\<>:"|?*]+$/.test(name)) {
      return NextResponse.json({ error: "Invalid folder name" }, { status: 400 });
    }

    const safePath = path.normalize(relPath || "").replace(/^(\.\.(\/|\\|$))+/, "");
    const dirPath = path.join(WORKSPACE, safePath);
    const newFolderPath = path.join(dirPath, name);
    const relNewPath = path.join(safePath, name).replace(/\\/g, "/");

    if (!newFolderPath.startsWith(WORKSPACE)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    try {
      await fs.mkdir(newFolderPath, { recursive: false });
      const operation = op(Date.now(), "mkdir", "Create folder", "mkdir(2)", relNewPath, null, true);
      return NextResponse.json({ success: true, operation });
    } catch (e) {
      if (e.code === "EEXIST") {
        const baseName = name.replace(/\(\d+\)$/, "");
        let suggestedName = null;
        for (let n = 2; n <= 20; n++) {
          const altName = `${baseName}(${n})`;
          const altPath = path.join(dirPath, altName);
          if (!(await pathExists(altPath))) {
            suggestedName = altName;
            break;
          }
        }
        return NextResponse.json({ error: "Folder already exists", suggestedName }, { status: 400 });
      }
      const operation = op(Date.now(), "mkdir", "Create folder", "mkdir(2)", relNewPath, null, false, e.message);
      return NextResponse.json({ success: false, error: e.message, operation }, { status: 500 });
    }
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
