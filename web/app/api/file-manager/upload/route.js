import { NextResponse } from "next/server";
import path from "path";
import fs from "fs/promises";
import { writeFile } from "fs/promises";

const WORKSPACE = process.env.WORKSPACE_PATH || path.join(process.cwd(), "workspace");
const MAX_STORAGE_BYTES = Number(process.env.MAX_STORAGE_BYTES) || 100 * 1024 * 1024;

function op(id, opName, description, syscall, pathArg, path2 = null, success, error = null) {
  return { id, op: opName, description, syscall, path: pathArg, path2, success, error };
}

export async function POST(request) {
  const ops = [];
  let id = Date.now();
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const relPath = formData.get("path") || "";

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const safePath = path.normalize(relPath).replace(/^(\.\.(\/|\\|$))+/, "");
    const dirPath = path.join(WORKSPACE, safePath);
    const filePath = path.join(dirPath, file.name);

    if (!filePath.startsWith(WORKSPACE)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    await fs.mkdir(dirPath, { recursive: true });
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const fileSize = buffer.length;

    const { totalSize } = await import("../storage-util");
    const { size: used } = await totalSize(WORKSPACE);
    if (used + fileSize > MAX_STORAGE_BYTES) {
      return NextResponse.json(
        { error: "Storage limit exceeded. Free some space or increase limit." },
        { status: 403 }
      );
    }

    await writeFile(filePath, buffer);
    ops.push(op(++id, "writeFile", "Upload file", "open(2)/write(2)/close(2)", filePath, null, true));

    return NextResponse.json({ success: true, operation: ops[0] });
  } catch (e) {
    ops.push(op(++id, "writeFile", "Upload file", "open(2)/write(2)/close(2)", "???", null, false, e.message));
    return NextResponse.json({ success: false, error: e.message, operation: ops[0] }, { status: 500 });
  }
}
