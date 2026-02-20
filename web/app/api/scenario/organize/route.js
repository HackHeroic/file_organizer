import { NextResponse } from "next/server";
import path from "path";
import fs from "fs/promises";
import { runOrganize, WORKSPACE } from "@/app/api/lib/run-cli";

const DOC_EXT = [".txt", ".pdf", ".docx", ".doc", ".xlsx", ".pptx"];
const IMG_EXT = [".jpg", ".jpeg", ".png", ".gif", ".bmp", ".svg"];
const AUD_EXT = [".mp3", ".wav", ".aac", ".flac", ".ogg"];
const VID_EXT = [".mp4", ".mkv", ".avi", ".mov", ".wmv"];

const TEXT_TEMPLATES = [
  "Meeting Notes - Q4 Planning\n\nDate: 2024-11-15\nAttendees: Alice, Bob, Charlie\n\nAgenda:\n1. Budget review for next quarter\n2. New product roadmap discussion\n3. Team restructuring proposals\n\nKey Decisions:\n- Approved 15% budget increase for R&D\n- Launch date set for March 2025\n- Two new hires approved for engineering team\n",
  "Project Status Report\n\nProject: Smart File Organizer v2.0\nStatus: On Track\nSprint: 14 of 20\n\nCompleted This Week:\n- Implemented file categorization algorithm\n- Added support for 15+ file extensions\n- Integrated with cloud storage API\n- Fixed 3 critical bugs from QA testing\n",
  "Dear Team,\n\nI hope this message finds you well. I wanted to share some exciting updates about our upcoming product launch.\n\nAfter months of hard work, we are pleased to announce that the Smart File Organizer will be released on March 15, 2025.\n\nKey Features:\n- Automatic file categorization by type\n- Smart duplicate detection\n- Cloud backup integration\n- Cross-platform compatibility\n\nBest regards,\nThe Development Team\n",
  "Recipe: Classic Chocolate Chip Cookies\n\nPrep Time: 15 minutes\nCook Time: 12 minutes\nServings: 48 cookies\n\nIngredients:\n- 2 1/4 cups all-purpose flour\n- 1 tsp baking soda\n- 1 tsp salt\n- 1 cup butter, softened\n- 2 large eggs\n- 2 cups chocolate chips\n\nInstructions:\n1. Preheat oven to 375 degrees F\n2. Mix flour, baking soda and salt\n3. Beat butter, sugars, eggs and vanilla\n4. Stir in chocolate chips\n5. Bake for 9 to 11 minutes\n",
  "Daily Journal Entry\n\nDate: Wednesday, November 20, 2024\nWeather: Partly cloudy, 18 degrees C\nMood: Productive and optimistic\n\nToday was a remarkably productive day. I managed to complete the file organization module that I have been working on for the past week.\n\nTomorrow, I plan to start working on the user interface improvements and write some unit tests for the sorting algorithm.\n\nGratitude list:\n- Supportive team members\n- Good health\n- Beautiful weather for running\n",
];

const ASSETS_DIR = path.join(process.cwd(), "assets");

async function pickRandomAsset(dir, extensions) {
  try {
    const entries = await fs.readdir(dir);
    const matches = entries.filter((name) => {
      const ext = path.extname(name).toLowerCase();
      return !name.startsWith(".") && extensions.includes(ext);
    });
    if (matches.length === 0) return null;
    const pick = matches[Math.floor(Math.random() * matches.length)];
    return path.join(dir, pick);
  } catch {
    return null;
  }
}

async function fillWithDemoContent(filePath, ops, id) {
  try {
    const stat = await fs.stat(filePath);
    if (stat.size > 0) return id;
  } catch {
    return id;
  }
  const ext = path.extname(filePath).toLowerCase();

  if (ext === ".txt") {
    const src = await pickRandomAsset(path.join(ASSETS_DIR, "documents"), [".txt"]);
    if (src) {
      await fs.copyFile(src, filePath);
      ops.push(op(++id, "copyFile", "Fill txt with demo content", "open(2)/read(2)/write(2)/close(2)", src, filePath, true));
    } else {
      const template = TEXT_TEMPLATES[Math.floor(Math.random() * TEXT_TEMPLATES.length)];
      await fs.writeFile(filePath, template, "utf8");
      ops.push(op(++id, "writeFile", "Fill txt with demo content", "open(2)/write(2)/close(2)", filePath, null, true));
    }
  } else if (ext === ".pdf") {
    const src = await pickRandomAsset(path.join(ASSETS_DIR, "documents"), [".pdf"]);
    if (src) {
      await fs.copyFile(src, filePath);
      ops.push(op(++id, "copyFile", "Fill pdf with demo content", "open(2)/read(2)/write(2)/close(2)", src, filePath, true));
    }
  } else if ([".png", ".jpg", ".jpeg"].includes(ext)) {
    const src = await pickRandomAsset(path.join(ASSETS_DIR, "images"), [".png", ".jpg", ".jpeg"]);
    if (src) {
      await fs.copyFile(src, filePath);
      ops.push(op(++id, "copyFile", "Fill image with demo content", "open(2)/read(2)/write(2)/close(2)", src, filePath, true));
    }
  } else if (ext === ".mp3") {
    const src = await pickRandomAsset(path.join(ASSETS_DIR, "audio"), [".mp3"]);
    if (src) {
      await fs.copyFile(src, filePath);
      ops.push(op(++id, "copyFile", "Fill mp3 with demo content", "open(2)/read(2)/write(2)/close(2)", src, filePath, true));
    }
  } else if (ext === ".mp4") {
    const src = await pickRandomAsset(path.join(ASSETS_DIR, "videos"), [".mp4"]);
    if (src) {
      await fs.copyFile(src, filePath);
      ops.push(op(++id, "copyFile", "Fill mp4 with demo content", "open(2)/read(2)/write(2)/close(2)", src, filePath, true));
    }
  }
  return id;
}

function op(id, opName, description, syscall, pathArg, path2 = null, success, error = null) {
  return { id, op: opName, description, syscall, path: pathArg, path2, success, error };
}

function getCategory(name) {
  const ext = path.extname(name).toLowerCase();
  if (DOC_EXT.includes(ext)) return "Documents";
  if (IMG_EXT.includes(ext)) return "Images";
  if (AUD_EXT.includes(ext)) return "Audio";
  if (VID_EXT.includes(ext)) return "Videos";
  return "Others";
}

export async function POST(request) {
  const ops = [];
  let id = 0;
  try {
    const { directoryPath } = await request.json();
    const subpath = directoryPath ? path.normalize(directoryPath).replace(/^(\.\.(\/|\\|$))+/, "") : "";

    // Try C backend first (real OS system calls)
    const cliResult = runOrganize(subpath);
    if (cliResult) {
      return NextResponse.json({
        operations: cliResult.operations,
        result: cliResult.result,
        backend: "c",
        ...(cliResult.error && { error: cliResult.error }),
      }, cliResult.error ? { status: 500 } : { status: 200 });
    }

    // Fallback: Node.js implementation
    const basePath = subpath ? path.join(WORKSPACE, subpath) : WORKSPACE;

    let entries;
    try {
      entries = await fs.readdir(basePath, { withFileTypes: true });
      ops.push(op(++id, "readdir", "Read directory entries", "getdents(2)/readdir(3)", basePath, null, true));
    } catch (e) {
      ops.push(op(++id, "readdir", "Read directory entries", "getdents(2)/readdir(3)", basePath, null, false, e.message));
      return NextResponse.json({ operations: ops, error: e.message, backend: "node" }, { status: 500 });
    }

    const categories = { Documents: [], Images: [], Audio: [], Videos: [], Others: [] };
    const dirs = {
      Documents: path.join(basePath, "Documents"),
      Images: path.join(basePath, "Images"),
      Audio: path.join(basePath, "Audio"),
      Videos: path.join(basePath, "Videos"),
      Others: path.join(basePath, "Others"),
    };

    for (const name of Object.keys(dirs)) {
      try {
        await fs.mkdir(dirs[name], { recursive: true });
        ops.push(op(++id, "mkdir", "Create category folder", "mkdir(2)", dirs[name], null, true));
      } catch (e) {
        ops.push(op(++id, "mkdir", "Create category folder", "mkdir(2)", dirs[name], null, false, e.message));
      }
    }

    for (const ent of entries) {
      if (ent.name.startsWith(".") || ent.name === ".." || ent.isDirectory()) continue;
      const category = getCategory(ent.name);
      const oldPath = path.join(basePath, ent.name);
      const newPath = path.join(dirs[category], ent.name);
      try {
        await fs.rename(oldPath, newPath);
        ops.push(op(++id, "rename", "Move file to category", "rename(2)", oldPath, newPath, true));
        categories[category].push(ent.name);
        // Fill moved file with demo content if empty
        id = await fillWithDemoContent(newPath, ops, id);
      } catch (e) {
        ops.push(op(++id, "rename", "Move file to category", "rename(2)", oldPath, newPath, false, e.message));
      }
    }

    return NextResponse.json({ operations: ops, result: categories, backend: "node" });
  } catch (e) {
    return NextResponse.json(
      { operations: ops, error: e.message, backend: "node" },
      { status: 500 }
    );
  }
}
