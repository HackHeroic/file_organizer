import path from "path";
import fs from "fs/promises";

const WORKSPACE = process.env.WORKSPACE_PATH || path.join(process.cwd(), "workspace");
const IMAGE_EXT = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp"]);
const TEXT_EXT = new Set([".txt", ".md", ".html", ".css", ".js", ".json", ".csv", ".xml"]);
const MAX_PDF_TEXT = 3000;
const MAX_IMAGES_PER_REQUEST = 8;
const MAX_IMAGE_BYTES = 4 * 1024 * 1024; // 4MB per image

function fullPath(rel) {
  const safe = path.normalize(rel || "").replace(/^(\.\.(\/|\\|$))+/, "");
  return path.join(WORKSPACE, safe);
}

export async function extractPdfText(filePath) {
  try {
    const pdfParse = (await import("pdf-parse")).default;
    const buf = await fs.readFile(filePath);
    const data = await pdfParse(buf);
    return (data.text || "").slice(0, MAX_PDF_TEXT);
  } catch {
    return "";
  }
}

export async function getFileContentInfo(relPath, root) {
  const full = fullPath(relPath);
  if (!full.startsWith(WORKSPACE)) return null;
  const ext = path.extname(relPath).toLowerCase();
  const stat = await fs.stat(full).catch(() => null);
  if (!stat || stat.isDirectory()) return null;

  if (ext === ".pdf") {
    const text = await extractPdfText(full);
    return { path: relPath, type: "pdf", text };
  }
  if (TEXT_EXT.has(ext)) {
    const buf = await fs.readFile(full, "utf8").catch(() => "");
    return { path: relPath, type: "text", text: (buf || "").slice(0, 3000) };
  }
  if (IMAGE_EXT.has(ext)) {
    const buf = await fs.readFile(full).catch(() => null);
    if (!buf || buf.length > MAX_IMAGE_BYTES) return { path: relPath, type: "image", base64: null };
    const mime = ext === ".png" ? "image/png" : ext === ".gif" ? "image/gif" : ext === ".webp" ? "image/webp" : "image/jpeg";
    return { path: relPath, type: "image", base64: buf.toString("base64"), mime };
  }
  return { path: relPath, type: "other", text: "" };
}

export function isImageExt(ext) {
  return IMAGE_EXT.has(ext);
}
