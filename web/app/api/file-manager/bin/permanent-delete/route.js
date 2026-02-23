import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { BIN_DIR, readBinMeta, writeBinMeta } from "../../bin-util";

export async function POST(request) {
  try {
    const { uuids } = await request.json();
    if (!Array.isArray(uuids) || uuids.length === 0) {
      return NextResponse.json({ error: "uuids array required" }, { status: 400 });
    }

    const binMeta = await readBinMeta();
    const successful = [];
    const errors = [];

    for (const uuid of uuids) {
      const sourcePath = path.join(BIN_DIR, uuid);
      
      try {
        const stat = await fs.stat(sourcePath).catch(() => null);
        if (stat) {
          if (stat.isDirectory()) {
            await fs.rm(sourcePath, { recursive: true, force: true });
          } else {
            await fs.unlink(sourcePath);
          }
        }
        
        if (binMeta.items[uuid]) {
          delete binMeta.items[uuid];
        }
        successful.push(uuid);
      } catch (e) {
        errors.push({ uuid, error: e.message });
      }
    }

    await writeBinMeta(binMeta);

    return NextResponse.json({ success: true, deleted: successful, errors });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
