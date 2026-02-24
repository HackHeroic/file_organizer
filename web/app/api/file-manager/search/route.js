import { NextResponse } from "next/server";
import path from "path";
import fs from "fs/promises";
import { readMeta } from "../meta-util";

const WORKSPACE = process.env.WORKSPACE_PATH || path.join(process.cwd(), "workspace");

async function walk(dirPath, relPath, results, metaInfo) {
  const entries = await fs.readdir(dirPath, { withFileTypes: true }).catch(() => []);
  for (const ent of entries) {
    if (ent.name.startsWith(".")) continue;
    const full = path.join(dirPath, ent.name);
    const rel = relPath ? `${relPath}/${ent.name}` : ent.name;
    const itemStat = await fs.stat(full).catch(() => null);
    results.push({
      path: rel.replace(/\\/g, "/"),
      name: ent.name,
      type: ent.isDirectory() ? "directory" : "file",
      modified: itemStat ? itemStat.mtime.toISOString() : null,
      color: metaInfo[rel.replace(/\\/g, "/")]?.color || null,
    });
    if (ent.isDirectory()) await walk(full, rel, results, metaInfo);
  }
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const q = (searchParams.get("q") || "").trim().toLowerCase();
    if (!q) return NextResponse.json({ items: [] });

    const results = [];
    const data = await readMeta().catch(() => ({}));
    const metaInfo = data.meta || {};
    
    await walk(WORKSPACE, "", results, metaInfo);
    const qLower = q.toLowerCase();

    const nameMatched = results.filter((r) => {
      const name = r.name.toLowerCase();
      if (name.includes(qLower)) return true;
      const words = name.replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((w) => w.length > 0);
      const initials = words.map((w) => w[0]).join("");
      return initials === qLower || initials.includes(qLower);
    });

    const pathSet = new Set(results.map((r) => r.path.replace(/\\/g, "/")));
    const tagMatchedPaths = new Set();
    
    for (const [p, m] of Object.entries(metaInfo)) {
      const tags = m.tags || [];
      if (tags.some((t) => String(t).toLowerCase().includes(qLower) || qLower.includes(String(t).toLowerCase()))) {
        const norm = p.replace(/\\/g, "/");
        if (pathSet.has(norm)) tagMatchedPaths.add(norm);
      }
    }

    const seen = new Set();
    const combined = [];
    for (const r of nameMatched) {
      const key = r.path.replace(/\\/g, "/");
      if (!seen.has(key)) {
        seen.add(key);
        combined.push(r);
      }
    }
    for (const r of results) {
      const key = r.path.replace(/\\/g, "/");
      if (tagMatchedPaths.has(key) && !seen.has(key)) {
        seen.add(key);
        combined.push(r);
      }
    }
    const filtered = combined.slice(0, 100);
    return NextResponse.json({ items: filtered });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
