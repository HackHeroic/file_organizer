/**
 * Utilities for syncing vector index with file operations.
 * Used by upload, delete, delete-bulk for automatic indexing.
 */
import path from "path";
import fs from "fs/promises";
import { getFileContentInfo } from "./content-analysis";
import { upsertData, deleteByIds, isVectorAvailable } from "@/app/api/lib/upstash-vector";

const WORKSPACE = process.env.WORKSPACE_PATH || path.join(process.cwd(), "workspace");

function toId(relPath) {
  return "f_" + Buffer.from(relPath, "utf8").toString("base64url");
}

/** Optional: get AI text from image (OCR-style) */
async function getImageText(base64, mime, apiKey) {
  if (!apiKey) return null;
  try {
    const GEMINI_API = "https://generativelanguage.googleapis.com/v1beta/models";
    const model = (process.env.GEMINI_MODEL || "gemini-2.0-flash").trim();
    const res = await fetch(`${GEMINI_API}/${model}:generateContent?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{
          parts: [
            {
              text: "Extract ALL visible text from this image for search. Include titles, names, dates, logos. Reply with only the extracted text.",
            },
            { inlineData: { mimeType: mime || "image/jpeg", data: base64 } },
          ],
        }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 1500 },
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || null;
  } catch {
    return null;
  }
}

async function getTextToEmbed(relPath, name) {
  const info = await getFileContentInfo(relPath);
  if (!info) return `${name}`;
  if (info.type === "pdf" && info.text?.trim()) return info.text.slice(0, 4000);
  if (info.type === "docx" && info.text?.trim()) return info.text.slice(0, 4000);
  if (info.type === "xlsx" && info.text?.trim()) return info.text.slice(0, 4000);
  if (info.type === "text" && info.text?.trim()) return info.text.slice(0, 4000);
  if (info.type === "image") {
    const apiKey = process.env.GOOGLE_API_KEY?.trim();
    const desc = info.base64 ? await getImageText(info.base64, info.mime, apiKey) : null;
    if (desc) return `Image: ${name}. ${desc}`;
    const kw = name.replace(/[._-]/g, " ").replace(/\s+/g, " ").trim();
    return `Image: ${name}${kw ? `. ${kw}` : ""}`;
  }
  return `File: ${name}`;
}

/** Index a single file. Call after upload. */
export async function indexFile(relPath) {
  if (!isVectorAvailable()) return;
  const safePath = relPath.replace(/\\/g, "/");
  try {
    const full = path.join(WORKSPACE, path.normalize(safePath).replace(/^(\.\.(\/|\\|$))+/, ""));
    if (!full.startsWith(WORKSPACE)) return;
    const stat = await fs.stat(full).catch(() => null);
    if (!stat || !stat.isFile()) return;
    const name = path.basename(safePath);
    const text = await getTextToEmbed(safePath, name);
    const id = toId(safePath);
    await upsertData([{ id, data: text, metadata: { path: safePath, name } }]);
  } catch (e) {
    console.warn("indexFile:", e.message);
  }
}

/** Remove file paths from index. Caller must pass full list (for dirs, list files recursively first). */
export async function removeFromIndex(filePaths) {
  if (!isVectorAvailable() || !filePaths?.length) return;
  const ids = filePaths.map((p) => toId(p.replace(/\\/g, "/")));
  try {
    await deleteByIds(ids);
  } catch (e) {
    console.warn("removeFromIndex:", e.message);
  }
}

/** List all file paths under a directory (for use before deleting the dir). */
export async function listFilesUnderDir(fullDirPath, basePath) {
  const out = [];
  const entries = await fs.readdir(fullDirPath, { withFileTypes: true }).catch(() => []);
  for (const e of entries) {
    if (e.name.startsWith(".")) continue;
    const rel = (basePath ? basePath + "/" : "") + e.name;
    if (e.isDirectory()) {
      out.push(...(await listFilesUnderDir(path.join(fullDirPath, e.name), rel)));
    } else {
      out.push(rel);
    }
  }
  return out;
}
