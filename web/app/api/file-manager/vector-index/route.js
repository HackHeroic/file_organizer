import { NextResponse } from "next/server";
import path from "path";
import fs from "fs/promises";
import { getFileContentInfo } from "../lib/content-analysis";
import { upsertData, isVectorAvailable } from "@/app/api/lib/upstash-vector";

const WORKSPACE = process.env.WORKSPACE_PATH || path.join(process.cwd(), "workspace");
const BATCH_SIZE = 50;

function fullPath(rel) {
  const safe = path.normalize(rel || "").replace(/^(\.\.(\/|\\|$))+/, "");
  return path.join(WORKSPACE, safe);
}

async function listAllFilesRecursive(dirPath, base) {
  const items = [];
  const entries = await fs.readdir(dirPath, { withFileTypes: true }).catch(() => []);
  for (const ent of entries) {
    if (ent.name.startsWith(".")) continue;
    const rel = path.join(base, ent.name).replace(/\\/g, "/");
    if (ent.isDirectory()) {
      const sub = await listAllFilesRecursive(path.join(dirPath, ent.name), rel);
      items.push(...sub);
    } else {
      items.push({ path: rel, name: ent.name, type: "file" });
    }
  }
  return items;
}

/** Optional: get AI description + OCR-style text from image (uses GOOGLE_API_KEY) */
async function describeImage(base64, mime, apiKey) {
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
              text: "Extract ALL visible text from this image for search indexing. Include: titles, names, dates, locations, logos, labels, captions. Combine into one block of text (no formatting). If it's a poster/flyer, include organization name, event, speaker, date, time. Reply with only the extracted text.",
            },
            { inlineData: { mimeType: mime || "image/jpeg", data: base64 } },
          ],
        }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 1500 },
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    return text || null;
  } catch {
    return null;
  }
}

/** Build text to embed for a file. Supports PDF, docx, xlsx, text, images, and fallback for other types. */
async function getTextToEmbed(relPath, name, apiKey) {
  const info = await getFileContentInfo(relPath);
  if (!info) return `${name}`;
  if (info.type === "pdf" && info.text?.trim()) return info.text.slice(0, 4000);
  if (info.type === "docx" && info.text?.trim()) return info.text.slice(0, 4000);
  if (info.type === "xlsx" && info.text?.trim()) return info.text.slice(0, 4000);
  if (info.type === "text" && info.text?.trim()) return info.text.slice(0, 4000);
  if (info.type === "image") {
    const desc = info.base64 ? await describeImage(info.base64, info.mime, apiKey) : null;
    if (desc) return `Image: ${name}. ${desc}`;
    const keywords = name.replace(/[._-]/g, " ").replace(/\s+/g, " ").trim();
    return `Image: ${name}${keywords ? `. Visual content may include: ${keywords}` : ""}`;
  }
  if (info.type === "other") return `File: ${name}`;
  return `${name}`;
}

/** GET: Check if vector search is configured */
export async function GET() {
  const hasVector = isVectorAvailable();
  return NextResponse.json({
    configured: hasVector,
    vectorConfigured: hasVector,
    message: !hasVector
      ? "Set UPSTASH_VECTOR_REST_URL and UPSTASH_VECTOR_REST_TOKEN"
      : "Ready (uses Upstash built-in embeddings)",
  });
}

/** POST: Index workspace or specific path. Body: { path?: string } */
export async function POST(request) {
  if (!isVectorAvailable()) {
    return NextResponse.json(
      { error: "Vector search not configured. Set UPSTASH_VECTOR_REST_URL and UPSTASH_VECTOR_REST_TOKEN." },
      { status: 503 }
    );
  }

  try {
    const body = await request.json().catch(() => ({}));
    const relPath = body.path || "";
    const safePath = path.normalize(relPath).replace(/^(\.\.(\/|\\|$))+/, "").replace(/^[\/\\]+/, "") || "";
    const dirPath = fullPath(safePath);

    if (!dirPath.startsWith(WORKSPACE)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const stat = await fs.stat(dirPath).catch(() => null);
    if (!stat) return NextResponse.json({ error: "Path not found" }, { status: 404 });

    const base = safePath;
    const files = stat.isDirectory()
      ? await listAllFilesRecursive(dirPath, base || "")
      : [{ path: safePath || path.basename(dirPath), name: path.basename(dirPath), type: "file" }];

    const apiKey = process.env.GOOGLE_API_KEY?.trim();
    const items = [];
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      if (f.type !== "file") continue;
      const text = await getTextToEmbed(f.path, f.name, apiKey);
      const id = "f_" + Buffer.from(f.path, "utf8").toString("base64url");
      items.push({ id, data: text, metadata: { path: f.path, name: f.name } });
      if (items.length >= BATCH_SIZE) {
        await upsertData(items);
        items.length = 0;
      }
    }
    if (items.length > 0) {
      await upsertData(items);
    }

    return NextResponse.json({
      success: true,
      indexed: files.filter((x) => x.type === "file").length,
    });
  } catch (e) {
    console.error("vector-index:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
