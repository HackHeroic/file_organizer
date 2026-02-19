import { NextResponse } from "next/server";
import path from "path";
import fs from "fs/promises";

const WORKSPACE = process.env.WORKSPACE_PATH || path.join(process.cwd(), "workspace");

async function getRecursiveTree(dirPath) {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  const tree = [];

  for (const ent of entries) {
    if (ent.name.startsWith(".")) continue; // simple hidden file filter
    const fullPath = path.join(dirPath, ent.name);
    const relativePath = path.relative(WORKSPACE, fullPath);
    
    const node = {
      name: ent.name,
      path: relativePath,
      type: ent.isDirectory() ? "directory" : "file",
    };

    if (ent.isDirectory()) {
      node.children = await getRecursiveTree(fullPath);
    }

    tree.push(node);
  }
  return tree;
}

export async function GET() {
  try {
    await fs.mkdir(WORKSPACE, { recursive: true });
    // Use recursive tree function
    const tree = await getRecursiveTree(WORKSPACE);
    return NextResponse.json({ workspace: WORKSPACE, tree });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
