import { NextResponse } from "next/server";
import path from "path";
import fs from "fs/promises";
import { readMeta, writeMeta } from "../meta-util";

const WORKSPACE = process.env.WORKSPACE_PATH || path.join(process.cwd(), "workspace");

async function pathExists(relPath) {
  try {
    const fullPath = path.join(WORKSPACE, relPath);
    if (!fullPath.startsWith(WORKSPACE)) return false;
    await fs.stat(fullPath);
    return true;
  } catch {
    return false;
  }
}

async function filterExistingPaths(paths) {
  const results = await Promise.all(paths.map(async (p) => ({ path: p, exists: await pathExists(p) })));
  return results.filter((r) => r.exists).map((r) => r.path);
}

export async function GET() {
  try {
    const data = await readMeta();
    const recents = data.recents || [];
    const meta = data.meta || {};
    const sharedLinks = data.sharedLinks || {};

    // Filter out paths that no longer exist (deleted files/folders)
    const existingRecents = await filterExistingPaths(recents);
    const metaPaths = Object.keys(meta);
    const existingMetaPaths = await filterExistingPaths(metaPaths);
    const sharedPaths = Object.keys(sharedLinks);
    const existingSharedPaths = await filterExistingPaths(sharedPaths);

    const filteredMeta = {};
    for (const p of existingMetaPaths) {
      filteredMeta[p] = meta[p];
    }
    const filteredSharedLinks = {};
    for (const p of existingSharedPaths) {
      filteredSharedLinks[p] = sharedLinks[p];
    }

    return NextResponse.json({
      recents: existingRecents,
      meta: filteredMeta,
      sharedLinks: filteredSharedLinks,
    });
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
    if (body.sharedLinks !== undefined) {
      data.sharedLinks = data.sharedLinks || {};
      if (body.sharedLinks.path !== undefined && body.sharedLinks.token !== undefined) {
        data.sharedLinks[body.sharedLinks.path] = { token: body.sharedLinks.token, createdAt: new Date().toISOString() };
      }
    }
    if (body.userWorkspacesAdd !== undefined) {
      const name = String(body.userWorkspacesAdd).trim();
      if (name && !/[\\/]/.test(name)) {
        data.userWorkspaces = data.userWorkspaces || [];
        if (!data.userWorkspaces.includes(name)) data.userWorkspaces.push(name);
      }
    }
    await writeMeta(data);
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
