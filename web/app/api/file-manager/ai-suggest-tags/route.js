import { NextResponse } from "next/server";
import path from "path";
import fs from "fs/promises";

const WORKSPACE = process.env.WORKSPACE_PATH || path.join(process.cwd(), "workspace");
const GEMINI_API = "https://generativelanguage.googleapis.com/v1beta/models";

function safePath(rel) {
  return path.normalize(rel || "").replace(/^(\.\.(\/|\\|$))+/, "");
}

async function callGemini(prompt, apiKey, useFallback = false) {
  const model = useFallback ? "gemini-1.5-flash" : (process.env.GEMINI_MODEL || "gemini-2.0-flash").trim();
  const url = `${GEMINI_API}/${model}:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.3,
      },
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    if (!useFallback && (res.status === 404 || res.status === 400)) {
      return callGemini(prompt, apiKey, true);
    }
    throw new Error(`Gemini API error: ${res.status}`);
  }
  const data = await res.json();
  let text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("No response from Gemini");
  text = text.trim();
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) text = jsonMatch[0];
  try {
    return JSON.parse(text);
  } catch {
    throw new Error("Invalid JSON from Gemini");
  }
}

const TEXT_EXT = new Set([".txt", ".md", ".html", ".css", ".js", ".json", ".csv", ".xml"]);

export async function POST(request) {
  const apiKey = process.env.GOOGLE_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json(
      { error: "GOOGLE_API_KEY not set" },
      { status: 503 }
    );
  }

  try {
    const { path: relPath } = await request.json();
    const safe = safePath(relPath);
    const full = path.join(WORKSPACE, safe);
    if (!full.startsWith(WORKSPACE)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const stat = await fs.stat(full).catch(() => null);
    if (!stat || stat.isDirectory()) {
      return NextResponse.json({ error: "Not a file" }, { status: 400 });
    }

    const name = path.basename(safe);
    const ext = path.extname(name).toLowerCase();
    let contentPreview = "";

    if (TEXT_EXT.has(ext)) {
      const buf = await fs.readFile(full, "utf8").catch(() => "");
      contentPreview = (buf || "").slice(0, 1500);
    }

    const prompt = `Suggest 3-5 short tags (single words or 2-word phrases) to help organize this file. Use lowercase.
Filename: "${name}"
${contentPreview ? `Content preview:\n${contentPreview}` : "Binary/file type - use filename and extension only."}
Respond with JSON only: {"tags": ["tag1", "tag2", "tag3"]}`;

    const parsed = await callGemini(prompt, apiKey);
    const tags = Array.isArray(parsed?.tags) ? parsed.tags : [];
    return NextResponse.json({ tags: tags.slice(0, 5) });
  } catch (e) {
    console.error("AI suggest tags error:", e);
    return NextResponse.json(
      { error: e.message || "Failed to suggest tags" },
      { status: 500 }
    );
  }
}
