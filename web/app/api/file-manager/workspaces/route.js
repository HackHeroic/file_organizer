import { NextResponse } from "next/server";
import path from "path";
import fs from "fs/promises";
import { seedWorkspaceIfEmpty } from "@/app/api/lib/seed-workspace";

const WORKSPACE = process.env.WORKSPACE_PATH || path.join(process.cwd(), "workspace");

export async function GET() {
  try {
    await fs.mkdir(WORKSPACE, { recursive: true });
    await seedWorkspaceIfEmpty();
    const entries = await fs.readdir(WORKSPACE, { withFileTypes: true });
    const names = entries.filter((e) => e.isDirectory() && !e.name.startsWith(".")).map((e) => e.name);
    return NextResponse.json({ workspaces: ["My Files", ...names] });
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
    const entries = await fs.readdir(WORKSPACE, { withFileTypes: true });
    const names = entries.filter((e) => e.isDirectory() && !e.name.startsWith(".")).map((e) => e.name);
    return NextResponse.json({ workspaces: ["My Files", ...names] });
  } catch (e) {
    if (e.code === "EEXIST") return NextResponse.json({ error: "Workspace already exists" }, { status: 400 });
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
