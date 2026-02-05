import { NextResponse } from "next/server";
import path from "path";
import fs from "fs/promises";

const WORKSPACE = path.join(process.cwd(), "workspace");

export async function GET() {
  try {
    await fs.mkdir(WORKSPACE, { recursive: true });
    const entries = await fs.readdir(WORKSPACE, { withFileTypes: true });
    const dirs = entries.filter((e) => e.isDirectory()).map((e) => e.name);
    return NextResponse.json({ workspace: WORKSPACE, directories: dirs });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
