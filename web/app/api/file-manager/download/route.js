import { NextResponse } from "next/server";
import path from "path";
import fs from "fs/promises";

const WORKSPACE = process.env.WORKSPACE_PATH || path.join(process.cwd(), "workspace");

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const relPath = searchParams.get("path") || "";
    const safePath = path.normalize(relPath).replace(/^(\.\.(\/|\\|$))+/, "");
    const filePath = path.join(WORKSPACE, safePath);

    if (!filePath.startsWith(WORKSPACE)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const stat = await fs.stat(filePath).catch(() => null);
    if (!stat || stat.isDirectory()) {
      return NextResponse.json({ error: "Not a file" }, { status: 400 });
    }

    const fileBuffer = await fs.readFile(filePath);
    const fileName = path.basename(filePath);

    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
