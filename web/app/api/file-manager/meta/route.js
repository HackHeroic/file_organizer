import { NextResponse } from "next/server";
import path from "path";
import fs from "fs/promises";

const WORKSPACE = path.join(process.cwd(), "workspace");
const META_PATH = path.join(WORKSPACE, ".file-organizer-meta.json");

async function readMeta() {
  try {
    const raw = await fs.readFile(META_PATH, "utf8");
    return JSON.parse(raw);
  } catch {
    return { recents: [], meta: {} };
  }
}

async function writeMeta(data) {
  await fs.mkdir(WORKSPACE, { recursive: true });
  await fs.writeFile(META_PATH, JSON.stringify(data, null, 2), "utf8");
}

export async function GET() {
  try {
    const data = await readMeta();
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const data = await readMeta();
    if (body.recents !== undefined) {
      const pathToAdd = body.path;
      if (pathToAdd) {
        data.recents = data.recents || [];
        data.recents = data.recents.filter((p) => p !== pathToAdd);
        data.recents.unshift(pathToAdd);
        data.recents = data.recents.slice(0, 50);
      }
    }
    if (body.meta !== undefined && body.path) {
      const safePath = path.normalize(body.path).replace(/^(\.\.(\/|\\|$))+/, "");
      data.meta = data.meta || {};
      data.meta[safePath] = { ...(data.meta[safePath] || {}), ...body.meta };
    }
    await writeMeta(data);
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
