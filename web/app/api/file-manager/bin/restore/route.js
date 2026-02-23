import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { BIN_DIR, readBinMeta, writeBinMeta } from "../../bin-util";
import { readMeta, writeMeta } from "../../meta-util";

const WORKSPACE = process.env.WORKSPACE_PATH || path.join(process.cwd(), "workspace");

export async function POST(request) {
  try {
    const { uuids } = await request.json();
    if (!Array.isArray(uuids) || uuids.length === 0) {
      return NextResponse.json({ error: "uuids array required" }, { status: 400 });
    }

    const binMeta = await readBinMeta();
    const successful = [];
    const errors = [];
    
    let mainMeta;
    try {
      mainMeta = await readMeta();
    } catch (_) {
      mainMeta = { meta: {} };
    }
    let metaChanged = false;

    for (const uuid of uuids) {
      if (!binMeta.items[uuid]) {
        errors.push({ uuid, error: "Not found in bin metadata" });
        continue;
      }

      const itemInfo = binMeta.items[uuid];
      const sourcePath = path.join(BIN_DIR, uuid);
      const targetRelPath = itemInfo.originalPath;
      const safeTargetRelPath = path.normalize(targetRelPath).replace(/^(\.\.(\/|\\|$))+/, "");
      const targetPath = path.join(WORKSPACE, safeTargetRelPath);

      if (!targetPath.startsWith(WORKSPACE) || safeTargetRelPath.startsWith(".bin")) {
        errors.push({ uuid, error: "Invalid target path" });
        continue;
      }

      try {
        // Ensure the parent directory exists
        const targetDir = path.dirname(targetPath);
        await fs.mkdir(targetDir, { recursive: true });
        
        // Restore
        await fs.rename(sourcePath, targetPath);
        
        // Remove from metadata
        delete binMeta.items[uuid];
        successful.push(uuid);
        
        // Restore color to metadata if it exists
        if (itemInfo.color) {
          mainMeta.meta = mainMeta.meta || {};
          mainMeta.meta[safeTargetRelPath] = mainMeta.meta[safeTargetRelPath] || {};
          mainMeta.meta[safeTargetRelPath].color = itemInfo.color;
          metaChanged = true;
        }
      } catch (e) {
        errors.push({ uuid, error: e.message });
      }
    }

    await writeBinMeta(binMeta);
    if (metaChanged) {
      await writeMeta(mainMeta).catch(() => {});
    }

    return NextResponse.json({ success: true, restored: successful, errors });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
