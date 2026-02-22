import { NextResponse } from "next/server";
import path from "path";
import fs from "fs/promises";
import { runCreateDir, WORKSPACE } from "@/app/api/lib/run-cli";

const ASSETS_DIR = path.join(process.cwd(), "assets");

function op(id, opName, description, syscall, pathArg, path2 = null, success, error = null) {
  return { id, op: opName, description, syscall, path: pathArg, path2, success, error };
}

/** Pick one random file from a directory matching given extensions. Returns full path or null. */
async function pickRandomAsset(dir, extensions) {
  try {
    const entries = await fs.readdir(dir);
    const matches = entries.filter((name) => {
      const ext = path.extname(name).toLowerCase();
      return !name.startsWith(".") && extensions.includes(ext);
    });
    if (matches.length === 0) return null;
    const pick = matches[Math.floor(Math.random() * matches.length)];
    return path.join(dir, pick);
  } catch {
    return null;
  }
}

/** Generate list of { srcPath, destName } by picking one random file from each category. */
async function pickAssetsFromCategories() {
  const categories = [
    { dir: path.join(ASSETS_DIR, "audio"), exts: [".mp3"], destName: (n) => n },
    { dir: path.join(ASSETS_DIR, "videos"), exts: [".mp4"], destName: (n) => n },
    { dir: path.join(ASSETS_DIR, "images"), exts: [".png", ".jpg", ".jpeg"], destName: (n) => n },
    { dir: path.join(ASSETS_DIR, "documents", "txt"), exts: [".txt"], destName: (n) => n },
    { dir: path.join(ASSETS_DIR, "documents", "pdf"), exts: [".pdf"], destName: (n) => n },
  ];
  const picks = [];
  for (const cat of categories) {
    const src = await pickRandomAsset(cat.dir, cat.exts);
    if (src) picks.push({ srcPath: src, destName: path.basename(src) });
  }
  return picks;
}

export async function POST(request) {
  const ops = [];
  let id = 0;
  try {
    const { dirName, fileNames: userFileNames } = await request.json();
    if (!dirName || typeof dirName !== "string" || !dirName.trim()) {
      return NextResponse.json(
        { error: "dirName is required" },
        { status: 400 }
      );
    }

    const trimmedDirName = dirName.trim();
    const safeDirName = path.normalize(trimmedDirName).replace(/^(\.\.(\/|\\|$))+/, "").replace(/^[\/\\]+/, "") || trimmedDirName;
    if (!safeDirName || safeDirName.includes("..")) {
      return NextResponse.json({ error: "Invalid directory name" }, { status: 400 });
    }
    const useAssetPopulate = !Array.isArray(userFileNames) || userFileNames.length === 0;

    // When populating from assets: use Node.js only (copy real files from assets).
    if (useAssetPopulate) {
      const assetPicks = await pickAssetsFromCategories();
      if (assetPicks.length === 0) {
        return NextResponse.json(
          { error: "No assets found in audio, video, image, txt, or pdf folders" },
          { status: 500 }
        );
      }

      await fs.mkdir(WORKSPACE, { recursive: true }).catch(() => {});
      const dirPath = path.join(WORKSPACE, safeDirName);

      try {
        await fs.mkdir(dirPath, { recursive: false });
        ops.push(op(++id, "mkdir", "Create directory", "mkdir(2)", dirPath, null, true));
      } catch (e) {
        if (e.code === "EEXIST") {
          ops.push(op(++id, "mkdir", "Create directory (already exists)", "mkdir(2)", dirPath, null, true));
        } else {
          ops.push(op(++id, "mkdir", "Create directory", "mkdir(2)", dirPath, null, false, e.message));
          return NextResponse.json({ operations: ops, error: e.message, backend: "node" }, { status: 500 });
        }
      }

      for (const { srcPath, destName } of assetPicks) {
        const destPath = path.join(dirPath, destName);
        try {
          await fs.copyFile(srcPath, destPath);
          ops.push(op(++id, "copyFile", "Populate from assets", "open(2)/read(2)/write(2)/close(2)", srcPath, destPath, true));
        } catch (e) {
          ops.push(op(++id, "copyFile", "Populate from assets", "open(2)/read(2)/write(2)/close(2)", srcPath, destPath, false, e.message));
        }
      }

      const result = { dirPath, created: assetPicks.length };
      return NextResponse.json({ operations: ops, result, backend: "node" });
    }

    // User-provided file names: try C backend first (creates empty files)
    const fileNames = userFileNames;
    await fs.mkdir(WORKSPACE, { recursive: true }).catch(() => {});

    const cliResult = runCreateDir(safeDirName, fileNames);
    if (cliResult) {
      return NextResponse.json({
        operations: cliResult.operations,
        result: cliResult.result,
        backend: "c",
        ...(cliResult.error && { error: cliResult.error }),
      }, cliResult.error ? { status: 500 } : { status: 200 });
    }

    // Fallback: Node.js implementation for user-provided file names
    await fs.mkdir(WORKSPACE, { recursive: true }).catch(() => {});
    const dirPath = path.join(WORKSPACE, safeDirName);

    try {
      await fs.mkdir(dirPath, { recursive: false });
      ops.push(op(++id, "mkdir", "Create directory", "mkdir(2)", dirPath, null, true));
    } catch (e) {
      if (e.code === "EEXIST") {
        ops.push(op(++id, "mkdir", "Create directory (already exists)", "mkdir(2)", dirPath, null, true));
      } else {
        ops.push(op(++id, "mkdir", "Create directory", "mkdir(2)", dirPath, null, false, e.message));
        return NextResponse.json({ operations: ops, error: e.message, backend: "node" }, { status: 500 });
      }
    }

    for (const fileName of fileNames) {
      const filePath = path.join(dirPath, fileName);
      try {
        await fs.writeFile(filePath, "", "utf8");
        ops.push(op(++id, "writeFile", "Create file", "open(2)/write(2)/close(2)", filePath, null, true));
      } catch (e) {
        ops.push(op(++id, "writeFile", "Create file", "open(2)/write(2)/close(2)", filePath, null, false, e.message));
      }
    }

    const result = { dirPath, created: fileNames.length };
    return NextResponse.json({ operations: ops, result, backend: "node" });
  } catch (e) {
    return NextResponse.json(
      { operations: ops, error: e.message, backend: "node" },
      { status: 500 }
    );
  }
}
