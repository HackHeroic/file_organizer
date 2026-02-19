import { NextResponse } from "next/server";
import path from "path";
import fs from "fs/promises";

const WORKSPACE = process.env.WORKSPACE_PATH || path.join(process.cwd(), "workspace");
const GEMINI_API = "https://generativelanguage.googleapis.com/v1beta/models";

function safePath(rel) {
  return path.normalize(rel || "").replace(/^(\.\.(\/|\\|$))+/, "");
}

function fullPath(rel) {
  return path.join(WORKSPACE, safePath(rel));
}

const FALLBACK_MODEL = "gemini-1.5-flash";

async function callGemini(prompt, apiKey, useFallback = false) {
  const model = useFallback ? FALLBACK_MODEL : (process.env.GEMINI_MODEL || "gemini-2.0-flash").trim();
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
    if (!useFallback && (res.status === 404 || res.status === 400) && err.includes("model")) {
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

async function executeAction(action, params, currentPath, apiKey) {
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
    case "semantic_search": {
      const q = params?.query || params?.q || "";
      if (!q) throw new Error("search query required");
      const searchRoot = fullPath(base);
      if (!searchRoot.startsWith(WORKSPACE)) throw new Error("Access denied");
      const allItems = await listAllFilesRecursive(searchRoot, base || "");
      if (allItems.length === 0) return { success: true, action: "semantic_search", items: [], count: 0 };
      const matched = await semanticMatch(allItems, q, apiKey);
      return { success: true, action: "semantic_search", items: matched, count: matched.length };
    }
    case "suggest": {
      const p = fullPath(base);
      if (!p.startsWith(WORKSPACE)) throw new Error("Access denied");
      const entries = await fs.readdir(p, { withFileTypes: true });
      const fileList = [];
      for (const ent of entries) {
        if (ent.name.startsWith(".")) continue;
        const fp = path.join(p, ent.name);
        const s = await fs.stat(fp).catch(() => null);
        fileList.push({
          name: ent.name,
          type: ent.isDirectory() ? "directory" : "file",
          size: s?.isFile() ? s.size : null,
        });
      }
      const suggestions = await getSmartSuggestions(fileList, apiKey);
      return { success: true, action: "suggest", suggestions, items: fileList };
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

async function listAllFilesRecursive(dirPath, base) {
  const items = [];
  const entries = await fs.readdir(dirPath, { withFileTypes: true }).catch(() => []);
  for (const ent of entries) {
    if (ent.name.startsWith(".")) continue;
    const rel = path.join(base, ent.name).replace(/\\/g, "/");
    items.push({ path: rel, name: ent.name, type: ent.isDirectory() ? "directory" : "file" });
    if (ent.isDirectory()) {
      const sub = await listAllFilesRecursive(path.join(dirPath, ent.name), rel);
      items.push(...sub);
    }
  }
  return items;
}

async function semanticMatch(items, query, apiKey) {
  if (items.length === 0) return [];
  const fileList = items.slice(0, 150).map((i) => `PATH: ${i.path} | NAME: ${i.name} | TYPE: ${i.type}`).join("\n");
  const prompt = `User is searching for: "${query}"
Files in the workspace (use PATH exactly as shown):
${fileList}

Which PATH values match the user's intent? Consider meaning, not exact words (e.g. "budget spreadsheet" matches "reports/Q4_finances.xlsx").
Return JSON only: {"matches": ["path1", "path2", ...]} - use the exact PATH strings from above.`;
  const parsed = await callGemini(prompt, apiKey);
  const rawMatches = Array.isArray(parsed?.matches) ? parsed.matches : [];
  const matchSet = new Set(rawMatches.map((m) => String(m).trim().replace(/\\/g, "/")));
  return items.filter((i) => {
    const p = i.path.replace(/\\/g, "/");
    return matchSet.has(p) || matchSet.has(i.name) || matchSet.has(path.basename(p));
  });
}

async function getSmartSuggestions(fileList, apiKey) {
  if (fileList.length === 0) return { duplicates: [], folderSuggestions: [] };
  const names = fileList.map((f) => f.name);
  const listStr = fileList.map((f) => `- ${f.name} (${f.type}${f.size != null ? `, ${f.size} bytes` : ""})`).join("\n");
  const prompt = `Files in this folder (use EXACT names from the list):
${listStr}

1. Duplicates: Groups of files that might be duplicates (similar names or same size). Return {"duplicates": [["exact_name1", "exact_name2"], ["name3", "name4"]]}
2. Organization: Suggest folders to organize. Return {"folderSuggestions": [{"folder": "FolderName", "files": ["exact_name1", "exact_name2"]}]}

Use only exact file names from the list above. Return valid JSON: {"duplicates": [[...]], "folderSuggestions": [{"folder":"...", "files":[...]}]}`;
  const parsed = await callGemini(prompt, apiKey);
  const duplicates = Array.isArray(parsed?.duplicates) ? parsed.duplicates : [];
  const folderSuggestions = Array.isArray(parsed?.folderSuggestions) ? parsed.folderSuggestions : [];
  const nameSet = new Set(names);
  return {
    duplicates: duplicates.filter((grp) => Array.isArray(grp) && grp.some((n) => nameSet.has(String(n)))),
    folderSuggestions: folderSuggestions.filter(
      (s) => s && typeof s.folder === "string" && Array.isArray(s.files) && s.files.some((f) => nameSet.has(String(f)))
    ),
  };
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
5. search - Keyword search by filename (exact/substring). Params: {"query": "search_term"}
6. semantic_search - Search by meaning (e.g. "budget spreadsheet", "photos from trip"). Use when query describes intent, not exact filename. Params: {"query": "what user is looking for"}
7. suggest - Get smart suggestions: duplicates, folder organization. Use for "suggest organization", "find duplicates", "how to organize". Params: {}
Paths are relative to workspace root. For "current folder" use currentPath. For subfolders use "folder/subfolder".
Respond ONLY with valid JSON: {"action": "...", "params": {...}}`;

    const userPrompt = `User request: "${query}"`;
    const fullPrompt = `${systemPrompt}\n\n${userPrompt}`;

    const parsed = await callGemini(fullPrompt, apiKey);
    const action = parsed?.action?.toLowerCase?.() || parsed?.action;
    const params = parsed?.params || {};

    if (!action) throw new Error("AI did not return an action");

    const result = await executeAction(action, params, currentPath, apiKey);
    return NextResponse.json(result);
  } catch (e) {
    console.error("AI command error:", e);
    return NextResponse.json(
      { error: e.message || "AI command failed" },
      { status: 500 }
    );
  }
}
