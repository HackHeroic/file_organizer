import { NextResponse } from "next/server";
import path from "path";
import fs from "fs/promises";

const WORKSPACE = process.env.WORKSPACE_PATH || path.join(process.cwd(), "workspace");

async function walk(dirPath, relPath, results) {
  const entries = await fs.readdir(dirPath, { withFileTypes: true }).catch(() => []);
  for (const ent of entries) {
    if (ent.name.startsWith(".")) continue;
    const full = path.join(dirPath, ent.name);
    const rel = relPath ? `${relPath}/${ent.name}` : ent.name;
    results.push({
      path: rel.replace(/\\/g, "/"),
      name: ent.name,
      type: ent.isDirectory() ? "directory" : "file",
    });
    if (ent.isDirectory()) await walk(full, rel, results);
  }
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const q = (searchParams.get("q") || "").trim().toLowerCase();
    if (!q) return NextResponse.json({ items: [] });

    const results = [];
    await walk(WORKSPACE, "", results);
    const qLower = q.toLowerCase();
    const filtered = results.filter((r) => {
      const name = r.name.toLowerCase();
      if (name.includes(qLower)) return true;
      const words = name.replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((w) => w.length > 0);
      const initials = words.map((w) => w[0]).join("");
      return initials === qLower || initials.includes(qLower);
    }).slice(0, 100);
    return NextResponse.json({ items: filtered });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
