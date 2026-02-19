import { NextResponse } from "next/server";
import path from "path";
import fs from "fs/promises";
import crypto from "crypto";

const WORKSPACE = process.env.WORKSPACE_PATH || path.join(process.cwd(), "workspace");
const META_PATH = path.join(WORKSPACE, ".file-organizer-meta.json");

async function readMeta() {
  try {
    const raw = await fs.readFile(META_PATH, "utf8");
    return JSON.parse(raw);
  } catch {
    return { sharedLinks: {} };
  }
}

async function writeMeta(data) {
  await fs.mkdir(WORKSPACE, { recursive: true });
  await fs.writeFile(META_PATH, JSON.stringify(data, null, 2), "utf8");
}

export async function POST(request) {
  try {
    const { path: relPath } = await request.json();
    const safePath = path.normalize(relPath).replace(/^(\.\.(\/|\\|$))+/, "");
    const fullPath = path.join(WORKSPACE, safePath);
    if (!fullPath.startsWith(WORKSPACE)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }
    const stat = await fs.stat(fullPath).catch(() => null);
    if (!stat) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const data = await readMeta();
    data.sharedLinks = data.sharedLinks || {};
    const token = crypto.randomBytes(12).toString("base64url");
    data.sharedLinks[safePath] = { token, createdAt: new Date().toISOString() };
    await writeMeta(data);

    const base = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000";
    return NextResponse.json({ link: `${base}/share/${token}`, token });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");
    if (!token) return NextResponse.json({ error: "Missing token" }, { status: 400 });
    const data = await readMeta();
    const sharedLinks = data.sharedLinks || {};
    const entry = Object.entries(sharedLinks).find(([, v]) => v.token === token);
    if (!entry) return NextResponse.json({ error: "Link not found" }, { status: 404 });
    const relPath = entry[0];
    const fullPath = path.join(WORKSPACE, relPath);
    const stat = await fs.stat(fullPath).catch(() => null);
    const isFile = stat ? stat.isFile() : true; // default to file if stat fails
    return NextResponse.json({ path: relPath, isFile });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
