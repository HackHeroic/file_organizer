import { NextResponse } from "next/server";
import path from "path";
import fs from "fs/promises";

// Define workspace relative to the current working directory of the process
// This should match the other routes
const WORKSPACE = process.env.WORKSPACE_PATH || path.join(process.cwd(), "workspace");

export async function POST(request) {
    try {
        const { targetPath } = await request.json();

        // Safety check: Ensure targetPath is provided and doesn't try to go up directories
        if (!targetPath) {
            return NextResponse.json({ error: "Path validation failed" }, { status: 400 });
        }

        const safePath = path.normalize(targetPath).replace(/^(\.\.(\/|\\|$))+/, "");
        const fullPath = path.join(WORKSPACE, safePath);

        // Double check it's within workspace
        if (!fullPath.startsWith(WORKSPACE)) {
            return NextResponse.json({ error: "Access denied" }, { status: 403 });
        }

        const stat = await fs.stat(fullPath);
        let syscall = "";

        if (stat.isDirectory()) {
            await fs.rm(fullPath, { recursive: true, force: true });
            syscall = "rmdir(2) / unlinkat(2)";
        } else {
            await fs.unlink(fullPath);
            syscall = "unlink(2)";
        }

        return NextResponse.json({
            success: true,
            operation: {
                id: Date.now(),
                op: "delete",
                description: `Deleted ${stat.isDirectory() ? "directory" : "file"}`,
                syscall: syscall,
                path: safePath,
                success: true
            }
        });

    } catch (e) {
        console.error("Delete error:", e);
        return NextResponse.json({
            success: false,
            error: e.message,
            operation: {
                id: Date.now(),
                op: "delete",
                description: "Failed to delete",
                syscall: "unlink(2)", // Assumption
                path: "???",
                success: false,
                error: e.message
            }
        }, { status: 500 });
    }
}
