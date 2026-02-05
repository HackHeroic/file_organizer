import { NextResponse } from "next/server";
import path from "path";
import fs from "fs/promises";
import { runOrganize, WORKSPACE } from "@/app/api/lib/run-cli";

const DOC_EXT = [".txt", ".pdf", ".docx", ".doc", ".xlsx", ".pptx"];
const IMG_EXT = [".jpg", ".jpeg", ".png", ".gif", ".bmp", ".svg"];
const AUD_EXT = [".mp3", ".wav", ".aac", ".flac", ".ogg"];
const VID_EXT = [".mp4", ".mkv", ".avi", ".mov", ".wmv"];

function op(id, opName, description, syscall, pathArg, path2 = null, success, error = null) {
  return { id, op: opName, description, syscall, path: pathArg, path2, success, error };
}

function getCategory(name) {
  const ext = path.extname(name).toLowerCase();
  if (DOC_EXT.includes(ext)) return "Documents";
  if (IMG_EXT.includes(ext)) return "Images";
  if (AUD_EXT.includes(ext)) return "Audio";
  if (VID_EXT.includes(ext)) return "Videos";
  return "Others";
}

export async function POST(request) {
  const ops = [];
  let id = 0;
  try {
    const { directoryPath } = await request.json();
    const subpath = directoryPath ? path.normalize(directoryPath).replace(/^(\.\.(\/|\\|$))+/, "") : "";

    // Try C backend first (real OS system calls)
    const cliResult = runOrganize(subpath);
    if (cliResult) {
      return NextResponse.json({
        operations: cliResult.operations,
        result: cliResult.result,
        backend: "c",
        ...(cliResult.error && { error: cliResult.error }),
      }, cliResult.error ? { status: 500 } : { status: 200 });
    }

    // Fallback: Node.js implementation
    const basePath = subpath ? path.join(WORKSPACE, subpath) : WORKSPACE;

    let entries;
    try {
      entries = await fs.readdir(basePath, { withFileTypes: true });
      ops.push(op(++id, "readdir", "Read directory entries", "getdents(2)/readdir(3)", basePath, null, true));
    } catch (e) {
      ops.push(op(++id, "readdir", "Read directory entries", "getdents(2)/readdir(3)", basePath, null, false, e.message));
      return NextResponse.json({ operations: ops, error: e.message, backend: "node" }, { status: 500 });
    }

    const categories = { Documents: [], Images: [], Audio: [], Videos: [], Others: [] };
    const dirs = {
      Documents: path.join(basePath, "Documents"),
      Images: path.join(basePath, "Images"),
      Audio: path.join(basePath, "Audio"),
      Videos: path.join(basePath, "Videos"),
      Others: path.join(basePath, "Others"),
    };

    for (const name of Object.keys(dirs)) {
      try {
        await fs.mkdir(dirs[name], { recursive: true });
        ops.push(op(++id, "mkdir", "Create category folder", "mkdir(2)", dirs[name], null, true));
      } catch (e) {
        ops.push(op(++id, "mkdir", "Create category folder", "mkdir(2)", dirs[name], null, false, e.message));
      }
    }

    for (const ent of entries) {
      if (ent.name.startsWith(".") || ent.name === ".." || ent.isDirectory()) continue;
      const category = getCategory(ent.name);
      const oldPath = path.join(basePath, ent.name);
      const newPath = path.join(dirs[category], ent.name);
      try {
        await fs.rename(oldPath, newPath);
        ops.push(op(++id, "rename", "Move file to category", "rename(2)", oldPath, newPath, true));
        categories[category].push(ent.name);
      } catch (e) {
        ops.push(op(++id, "rename", "Move file to category", "rename(2)", oldPath, newPath, false, e.message));
      }
    }

    return NextResponse.json({ operations: ops, result: categories, backend: "node" });
  } catch (e) {
    return NextResponse.json(
      { operations: ops, error: e.message, backend: "node" },
      { status: 500 }
    );
  }
}
