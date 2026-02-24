import { NextResponse } from "next/server";
import path from "path";
import fs from "fs/promises";

const WORKSPACE = process.env.WORKSPACE_PATH || path.join(process.cwd(), "workspace");
const BIN_DIR = path.join(WORKSPACE, ".bin");
const META_FILE = path.join(BIN_DIR, ".metadata.json");

async function ensureBin() {
  await fs.mkdir(BIN_DIR, { recursive: true });
  try {
    const stat = await fs.stat(META_FILE);
    if (!stat.isFile()) {
        await fs.writeFile(META_FILE, JSON.stringify({ items: {} }), "utf8");
    }
  } catch (e) {
    if (e.code === "ENOENT") {
      await fs.writeFile(META_FILE, JSON.stringify({ items: {} }), "utf8");
    }
  }
}

async function readBinMeta() {
  await ensureBin();
  try {
    const data = await fs.readFile(META_FILE, "utf8");
    return JSON.parse(data);
  } catch (e) {
    return { items: {} };
  }
}

async function writeBinMeta(data) {
  await ensureBin();
  await fs.writeFile(META_FILE, JSON.stringify(data, null, 2), "utf8");
}

export { BIN_DIR, META_FILE, readBinMeta, writeBinMeta, ensureBin };
