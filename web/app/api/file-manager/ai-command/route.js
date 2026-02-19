import { NextResponse } from "next/server";
import path from "path";
import fs from "fs/promises";

const WORKSPACE = path.join(process.cwd(), "workspace");
const GEMINI_API = "https://generativelanguage.googleapis.com/v1beta/models";

function safePath(rel) {
  return path.normalize(rel || "").replace(/^(\.\.(\/|\\|$))+/, "");
}

function fullPath(rel) {
  return path.join(WORKSPACE, safePath(rel));
}

async function callGemini(prompt, apiKey) {
  const model = (process.env.GEMINI_MODEL || "gemini-2.0-flash").trim();
  const url = `${GEMINI_API}/${model}:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.2,
      },
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini API error: ${res.status} ${err}`);
  }
  const data = await res.json();
  let text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("No response from Gemini");
  text = text.trim();
  // Remove markdown code blocks if present
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) text = jsonMatch[0];
  return JSON.parse(text);
}

async function executeAction(action, params, currentPath) {
  const base = currentPath || "";
  const results = [];

  switch (action) {
    case "list": {
      const p = fullPath(base);
      if (!p.startsWith(WORKSPACE)) throw new Error("Access denied");
      const entries = await fs.readdir(p, { withFileTypes: true });
      const items = entries.filter((e) => !e.name.startsWith(".")).map((e) => ({
        name: e.name,
        type: e.isDirectory() ? "directory" : "file",
      }));
      return { success: true, action: "list", items, count: items.length };
    }
    case "create_folder": {
      const name = params?.name || params?.folderName;
      if (!name) throw new Error("Folder name required");
      const dirPath = path.join(fullPath(base), name);
      if (!dirPath.startsWith(WORKSPACE)) throw new Error("Access denied");
      await fs.mkdir(dirPath, { recursive: false });
      return { success: true, action: "create_folder", path: path.join(base, name).replace(/\\/g, "/") };
    }
    case "move": {
      const from = params?.from || params?.source;
      const to = params?.to || params?.destination;
      if (!from || !to) throw new Error("from and to paths required");
      const src = fullPath(from);
      const dest = fullPath(to);
      if (!src.startsWith(WORKSPACE) || !dest.startsWith(WORKSPACE)) throw new Error("Access denied");
      await fs.rename(src, dest);
      return { success: true, action: "move", from, to };
    }
    case "delete": {
      const targetPath = params?.path || params?.target;
      if (!targetPath) throw new Error("path required");
      const fp = fullPath(targetPath);
      if (!fp.startsWith(WORKSPACE)) throw new Error("Access denied");
      const stat = await fs.stat(fp);
      if (stat.isDirectory()) {
        await fs.rm(fp, { recursive: true });
      } else {
        await fs.unlink(fp);
      }
      return { success: true, action: "delete", path: targetPath };
    }
    case "search": {
      const q = params?.query || params?.q || "";
      if (!q) throw new Error("search query required");
      const results = await searchRecursive(WORKSPACE, q);
      return { success: true, action: "search", items: results, count: results.length };
    }
    default:
      throw new Error(`Unknown action: ${action}`);
  }
}

async function searchRecursive(dirPath, query, base = "") {
  const items = [];
  const entries = await fs.readdir(dirPath, { withFileTypes: true }).catch(() => []);
  for (const ent of entries) {
    if (ent.name.startsWith(".")) continue;
    const rel = path.join(base, ent.name).replace(/\\/g, "/");
    if (ent.name.toLowerCase().includes(query.toLowerCase())) {
      items.push({ path: rel, name: ent.name, type: ent.isDirectory() ? "directory" : "file" });
    }
    if (ent.isDirectory()) {
      const sub = await searchRecursive(path.join(dirPath, ent.name), query, rel);
      items.push(...sub);
    }
  }
  return items;
}

export async function POST(request) {
  const apiKey = process.env.GOOGLE_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json(
      { error: "GOOGLE_API_KEY not set. Add it to .env.local for AI commands." },
      { status: 503 }
    );
  }

  try {
    const { query, currentPath } = await request.json();
    if (!query || typeof query !== "string") {
      return NextResponse.json({ error: "query required" }, { status: 400 });
    }

    const systemPrompt = `You are a file organizer assistant. The user's current folder path is: "${currentPath || "(root)"}".
Available actions (respond with JSON only, no markdown):
1. list - List files in current folder. Use when user asks to list, show, see files. Params: {}
2. create_folder - Create a folder. Params: {"name": "folder_name"}
3. move - Move file/folder. Params: {"from": "source_path", "to": "dest_path"}
4. delete - Delete file/folder. Params: {"path": "path_to_delete"}
5. search - Search by filename. Params: {"query": "search_term"}
Paths are relative to workspace root. For "current folder" use currentPath. For subfolders use "folder/subfolder".
Respond ONLY with valid JSON: {"action": "...", "params": {...}}`;

    const userPrompt = `User request: "${query}"`;
    const fullPrompt = `${systemPrompt}\n\n${userPrompt}`;

    const parsed = await callGemini(fullPrompt, apiKey);
    const action = parsed?.action?.toLowerCase?.() || parsed?.action;
    const params = parsed?.params || {};

    if (!action) throw new Error("AI did not return an action");

    const result = await executeAction(action, params, currentPath);
    return NextResponse.json(result);
  } catch (e) {
    console.error("AI command error:", e);
    return NextResponse.json(
      { error: e.message || "AI command failed" },
      { status: 500 }
    );
  }
}
