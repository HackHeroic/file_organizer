import { NextResponse } from "next/server";
import path from "path";
import fs from "fs/promises";
import { getFileContentInfo } from "../lib/content-analysis";

const WORKSPACE = process.env.WORKSPACE_PATH || path.join(process.cwd(), "workspace");
const GEMINI_API = "https://generativelanguage.googleapis.com/v1beta/models";

function safePath(rel) {
  return path.normalize(rel || "").replace(/^(\.\.(\/|\\|$))+/, "");
}

async function callGeminiWithParts(parts, apiKey, useFallback = false) {
  const model = useFallback ? "gemini-1.5-flash" : (process.env.GEMINI_MODEL || "gemini-2.0-flash").trim();
  const url = `${GEMINI_API}/${model}:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts }],
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.4,
      },
    }),
  });
  if (!res.ok) {
    if (!useFallback && (res.status === 404 || res.status === 400)) {
      return callGeminiWithParts(parts, apiKey, true);
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
        temperature: 0.4,
      },
    }),
  });
  if (!res.ok) {
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

export async function POST(request) {
  const apiKey = process.env.GOOGLE_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json({ error: "GOOGLE_API_KEY not set" }, { status: 503 });
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
    const info = await getFileContentInfo(safe);
    const parts = [];

    if (info?.type === "image" && info.base64) {
      const textPrompt = `Based on the image above, generate a brief descriptive comment (1-2 sentences) to help remember what it shows.
Filename: "${name}"
Describe what you see (subjects, scene, context). Respond with JSON only: {"comment": "your generated comment here"}`;
      parts.push(
        { inlineData: { mimeType: info.mime || "image/jpeg", data: info.base64 } },
        { text: textPrompt }
      );
    } else if (info?.type === "pdf" && info.text) {
      const prompt = `Generate a brief descriptive comment (1-2 sentences) for this PDF to help remember what it is.
Filename: "${name}"
PDF content preview:\n${info.text.slice(0, 2500)}
Respond with JSON only: {"comment": "your generated comment here"}`;
      parts.push({ text: prompt });
    } else if (info?.type === "text" && info.text) {
      const prompt = `Generate a brief descriptive comment (1-2 sentences) for this file to help remember what it is.
Filename: "${name}"
Content preview:\n${info.text.slice(0, 2000)}
Respond with JSON only: {"comment": "your generated comment here"}`;
      parts.push({ text: prompt });
    } else {
      const prompt = `Generate a brief descriptive comment (1-2 sentences) for this file to help remember what it is.
Filename: "${name}"
Binary file - infer from filename and extension.
Respond with JSON only: {"comment": "your generated comment here"}`;
      parts.push({ text: prompt });
    }

    const parsed = parts.length > 1
      ? await callGeminiWithParts(parts, apiKey)
      : await callGemini(parts[0].text, apiKey);
    const comment = typeof parsed?.comment === "string" ? parsed.comment.trim() : "";
    return NextResponse.json({ comment });
  } catch (e) {
    console.error("AI suggest comment error:", e);
    return NextResponse.json(
      { error: e.message || "Failed to suggest comment" },
      { status: 500 }
    );
  }
}
