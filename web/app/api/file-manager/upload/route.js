import { NextResponse } from "next/server";
import path from "path";
import fs from "fs/promises";
import { writeFile } from "fs/promises";

const WORKSPACE = process.env.WORKSPACE_PATH || path.join(process.cwd(), "workspace");
const MAX_STORAGE_BYTES = Number(process.env.MAX_STORAGE_BYTES) || 500 * 1024 * 1024;

const DOC_EXT = [".txt", ".pdf", ".docx", ".doc", ".xlsx", ".pptx"];
const IMG_EXT = [".jpg", ".jpeg", ".png", ".gif", ".bmp", ".svg", ".webp"];
const AUD_EXT = [".mp3", ".wav", ".aac", ".flac", ".ogg"];
const VID_EXT = [".mp4", ".mkv", ".avi", ".mov", ".wmv"];

function getCategory(filename) {
  const ext = path.extname(filename).toLowerCase();
  if (DOC_EXT.includes(ext)) return "Documents";
  if (IMG_EXT.includes(ext)) return "Images";
  if (AUD_EXT.includes(ext)) return "Audio";
  if (VID_EXT.includes(ext)) return "Videos";
  return "Others";
}

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
    const baseDir = path.join(WORKSPACE, safePath);
    const category = getCategory(file.name);
    const lastSegment = path.basename(safePath);
    const categoryFolders = ["Documents", "Images", "Audio", "Videos", "Others"];
    // If already inside a category folder, save directly there; otherwise route to category subfolder
    const targetDir = categoryFolders.includes(lastSegment) ? baseDir : path.join(baseDir, category);
    const filePath = path.join(targetDir, file.name);

    if (!filePath.startsWith(WORKSPACE)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    await fs.mkdir(targetDir, { recursive: true });

    const overwrite = formData.get("overwrite") === "true";
    const existingStat = await fs.stat(filePath).catch(() => null);
    if (existingStat && existingStat.isFile() && !overwrite) {
      const relFilePath = path.relative(WORKSPACE, filePath).replace(/\\/g, "/");
      return NextResponse.json(
        { exists: true, fileName: file.name, path: relFilePath },
        { status: 409 }
      );
    }

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
