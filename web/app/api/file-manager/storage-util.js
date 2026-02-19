import path from "path";
import fs from "fs/promises";

export async function totalSize(dirPath) {
  let size = 0;
  let count = 0;
  const entries = await fs.readdir(dirPath, { withFileTypes: true }).catch(() => []);
  for (const ent of entries) {
    if (ent.name.startsWith(".")) continue;
    const full = path.join(dirPath, ent.name);
    if (ent.isDirectory()) {
      const sub = await totalSize(full);
      size += sub.size;
      count += sub.count;
    } else {
      const stat = await fs.stat(full).catch(() => null);
      if (stat) {
        size += stat.size;
        count += 1;
      }
    }
  }
  return { size, count };
}
