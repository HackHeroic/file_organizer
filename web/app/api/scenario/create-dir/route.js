import { NextResponse } from "next/server";
import path from "path";
import fs from "fs/promises";
import { runCreateDir, WORKSPACE } from "@/app/api/lib/run-cli";

function op(id, opName, description, syscall, pathArg, path2 = null, success, error = null) {
  return { id, op: opName, description, syscall, path: pathArg, path2, success, error };
}

export async function POST(request) {
  const ops = [];
  let id = 0;
  try {
    const { dirName, fileNames } = await request.json();
    if (!dirName || !Array.isArray(fileNames) || fileNames.length === 0) {
      return NextResponse.json(
        { error: "dirName and fileNames (array) required" },
        { status: 400 }
      );
    }

    // Ensure workspace exists (C CLI does not create it)
    await fs.mkdir(WORKSPACE, { recursive: true }).catch(() => {});

    // Try C backend first (real OS system calls)
    const cliResult = runCreateDir(dirName, fileNames);
    if (cliResult) {
      return NextResponse.json({
        operations: cliResult.operations,
        result: cliResult.result,
        backend: "c",
        ...(cliResult.error && { error: cliResult.error }),
      }, cliResult.error ? { status: 500 } : { status: 200 });
    }

    // Fallback: Node.js implementation
    await fs.mkdir(WORKSPACE, { recursive: true }).catch(() => {});
    const dirPath = path.join(WORKSPACE, dirName);

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
