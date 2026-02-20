import { spawnSync } from "child_process";
import path from "path";
import fs from "fs";

const WORKSPACE = process.env.WORKSPACE_PATH || path.join(process.cwd(), "workspace");

// CLI lives in project root (parent of web/)
const CLI_PATH = path.join(process.cwd(), "..", "new_organizer_cli");

function cliAvailable() {
  try {
    fs.accessSync(CLI_PATH, fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Run the C organizer CLI. Returns { operations, result, error } or throws.
 */
export function runCreateDir(dirName, fileNames) {
  if (!cliAvailable()) return null;
  const args = ["create-dir", WORKSPACE, dirName, ...fileNames];
  const out = spawnSync(CLI_PATH, args, {
    encoding: "utf8",
    maxBuffer: 2 * 1024 * 1024,
    cwd: path.join(process.cwd(), ".."),
  });
  if (out.error) return null;
  try {
    const line = out.stdout.trim().split("\n").pop();
    const data = JSON.parse(line);
    return { operations: data.operations || [], result: data.result, error: data.error };
  } catch {
    return null;
  }
}

export function runOrganize(directoryPath) {
  if (!cliAvailable()) return null;
  const subpath = directoryPath ? directoryPath.trim() : "";
  const assetsDir = path.join(process.cwd(), "assets");
  const args = subpath
    ? ["organize", WORKSPACE, subpath, assetsDir]
    : ["organize", WORKSPACE, "", assetsDir];
  const out = spawnSync(CLI_PATH, args, {
    encoding: "utf8",
    maxBuffer: 2 * 1024 * 1024,
    cwd: path.join(process.cwd(), ".."),
  });
  if (out.error) return null;
  try {
    const line = out.stdout.trim().split("\n").pop();
    const data = JSON.parse(line);
    return { operations: data.operations || [], result: data.result, error: data.error };
  } catch {
    return null;
  }
}

export { WORKSPACE, cliAvailable };
