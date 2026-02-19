import path from "path";
import fs from "fs/promises";

const WORKSPACE = process.env.WORKSPACE_PATH || path.join(process.cwd(), "workspace");
const META_PATH = path.join(WORKSPACE, ".file-organizer-meta.json");

export async function readMeta() {
  try {
    const raw = await fs.readFile(META_PATH, "utf8");
    return JSON.parse(raw);
  } catch {
    return { recents: [], meta: {}, sharedLinks: {} };
  }
}

export async function writeMeta(data) {
  await fs.mkdir(WORKSPACE, { recursive: true });
  await fs.writeFile(META_PATH, JSON.stringify(data, null, 2), "utf8");
}

/** Remove paths from meta (recents, starred, sharedLinks). Also removes any path under a deleted directory. */
export function removePathsFromMeta(data, deletedPaths) {
  const toRemove = new Set(deletedPaths);
  for (const d of deletedPaths) {
    const prefix = d + (d.endsWith("/") ? "" : "/");
    for (const p of [...Object.keys(data.meta || {}), ...(data.recents || []), ...Object.keys(data.sharedLinks || {})]) {
      if (p === d || p.startsWith(prefix)) toRemove.add(p);
    }
  }

  const recents = (data.recents || []).filter((p) => !toRemove.has(p));
  const meta = { ...(data.meta || {}) };
  for (const p of toRemove) delete meta[p];
  const sharedLinks = { ...(data.sharedLinks || {}) };
  for (const p of toRemove) delete sharedLinks[p];

  return { ...data, recents, meta, sharedLinks };
}
