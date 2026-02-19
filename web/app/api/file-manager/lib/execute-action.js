import path from "path";
import fs from "fs/promises";

const WORKSPACE = process.env.WORKSPACE_PATH || path.join(process.cwd(), "workspace");

function safePath(rel) {
  return path.normalize(rel || "").replace(/^(\.\.(\/|\\|$))+/, "");
}

export function fullPath(rel) {
  return path.join(WORKSPACE, safePath(rel));
}

export async function executeAction(action, params, currentPath) {
  const base = currentPath || "";
  const fp = (p) => fullPath(p);

  switch (action) {
    case "list": {
      const p = fp(base);
      if (!p.startsWith(WORKSPACE)) throw new Error("Access denied");
      const entries = await fs.readdir(p, { withFileTypes: true });
      const items = entries.filter((e) => !e.name.startsWith(".")).map((e) => ({
        name: e.name,
        type: e.isDirectory() ? "directory" : "file",
      }));
      return { success: true, action: "list", items, count: items.length };
    }
    case "create_folder": {
      const name = params?.name || params?.folderName;
      if (!name) throw new Error("Folder name required");
      const dirPath = path.join(fp(base), name);
      if (!dirPath.startsWith(WORKSPACE)) throw new Error("Access denied");
      await fs.mkdir(dirPath, { recursive: false });
      return { success: true, action: "create_folder", path: path.join(base, name).replace(/\\/g, "/") };
    }
    case "move": {
      const from = params?.from || params?.source;
      const to = params?.to || params?.destination;
      if (!from || !to) throw new Error("from and to paths required");
      const src = fp(from);
      const dest = fp(to);
      if (!src.startsWith(WORKSPACE) || !dest.startsWith(WORKSPACE)) throw new Error("Access denied");
      await fs.rename(src, dest);
      return { success: true, action: "move", from, to };
    }
    case "delete": {
      const targetPath = params?.path || params?.target;
      if (!targetPath) throw new Error("path required");
      const target = fp(targetPath);
      if (!target.startsWith(WORKSPACE)) throw new Error("Access denied");
      const stat = await fs.stat(target);
      if (stat.isDirectory()) {
        await fs.rm(target, { recursive: true });
      } else {
        await fs.unlink(target);
      }
      return { success: true, action: "delete", path: targetPath };
    }
    default:
      throw new Error(`Unknown action: ${action}`);
  }
}
