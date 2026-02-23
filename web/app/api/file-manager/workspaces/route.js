import { NextResponse } from "next/server";
import path from "path";
import fs from "fs/promises";
import { readMeta, writeMeta } from "../meta-util";

const WORKSPACE = process.env.WORKSPACE_PATH || path.join(process.cwd(), "workspace");
const DISK_LABEL = process.env.DISK_LABEL || "Local Disk";

export async function GET() {
  try {
    await fs.mkdir(WORKSPACE, { recursive: true });
    const data = await readMeta().catch(() => ({}));
    const userWorkspaces = data.userWorkspaces || [];
    // Only include workspaces that still exist on disk
    const entries = await fs.readdir(WORKSPACE, { withFileTypes: true });
    const existingDirs = new Set(entries.filter((e) => e.isDirectory() && !e.name.startsWith(".")).map((e) => e.name));
    const workspaces = userWorkspaces.filter((name) => existingDirs.has(name));
    return NextResponse.json({ diskLabel: DISK_LABEL, workspaces });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { name } = await request.json();
    if (!name || !/^[^/\\<>:"|?*]+$/.test(name)) {
      return NextResponse.json({ error: "Invalid workspace name" }, { status: 400 });
    }
    const fullPath = path.join(WORKSPACE, name);
    await fs.mkdir(fullPath, { recursive: false });
    const data = await readMeta().catch(() => ({}));
    const userWorkspaces = data.userWorkspaces || [];
    if (!userWorkspaces.includes(name)) {
      userWorkspaces.push(name);
      await writeMeta({ ...data, userWorkspaces });
    }
    const entries = await fs.readdir(WORKSPACE, { withFileTypes: true });
    const existingDirs = new Set(entries.filter((e) => e.isDirectory() && !e.name.startsWith(".")).map((e) => e.name));
    const workspaces = userWorkspaces.filter((n) => existingDirs.has(n));
    return NextResponse.json({ diskLabel: DISK_LABEL, workspaces });
  } catch (e) {
    if (e.code === "EEXIST") return NextResponse.json({ error: "Workspace already exists" }, { status: 400 });
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
