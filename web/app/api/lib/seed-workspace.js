import path from "path";
import fs from "fs/promises";

const WORKSPACE = process.env.WORKSPACE_PATH || path.join(process.cwd(), "workspace");

/** Seeds workspace with a default folder when empty (e.g. on Railway deploy). */
export async function seedWorkspaceIfEmpty() {
  const seedDisabled = process.env.SEED_WORKSPACE === "false";
  if (seedDisabled) return;

  try {
    await fs.mkdir(WORKSPACE, { recursive: true });
    const entries = await fs.readdir(WORKSPACE, { withFileTypes: true });
    const hasVisibleDirs = entries.some((e) => e.isDirectory() && !e.name.startsWith("."));
    if (hasVisibleDirs) return;

    const defaultDir = "hi";
    const dirPath = path.join(WORKSPACE, defaultDir);
    await fs.mkdir(dirPath, { recursive: true });
    await fs.writeFile(
      path.join(dirPath, "readme.txt"),
      "Welcome to File Organizer.\n\nCreate folders, upload files, or use Scenario 1 to add more content.",
      "utf8"
    );
  } catch (e) {
    console.error("seed-workspace:", e.message);
  }
}
