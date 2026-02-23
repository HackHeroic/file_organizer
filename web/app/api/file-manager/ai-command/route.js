import { NextResponse } from "next/server";
import path from "path";
import fs from "fs/promises";
import { getFileContentInfo } from "../lib/content-analysis";

const WORKSPACE = process.env.WORKSPACE_PATH || path.join(process.cwd(), "workspace");
const GEMINI_API = "https://generativelanguage.googleapis.com/v1beta/models";

function safePath(rel) {
  return path.normalize(rel || "").replace(/^(\.\.(\/|\\|$))+/, "");
}

function fullPath(rel) {
  return path.join(WORKSPACE, safePath(rel));
}

const FALLBACK_MODEL = "gemini-1.5-flash";

async function callGeminiWithParts(parts, apiKey, useFallback = false) {
  const model = useFallback ? FALLBACK_MODEL : (process.env.GEMINI_MODEL || "gemini-2.0-flash").trim();
  const url = `${GEMINI_API}/${model}:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts }],
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.2,
      },
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    if (!useFallback && (res.status === 404 || res.status === 400) && err.includes("model")) {
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
  return callGeminiWithParts([{ text: prompt }], apiKey, useFallback);
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
      let name = params?.name || params?.folderName;
      if (!name) throw new Error("Folder name required");
      const baseDir = fullPath(base);
      if (!baseDir.startsWith(WORKSPACE)) throw new Error("Access denied");
      let dirPath = path.join(baseDir, name);
      let attempt = 1;
      while (true) {
        try {
          await fs.mkdir(dirPath, { recursive: false });
          break;
        } catch (e) {
          if (e.code === "EEXIST" && attempt < 10) {
            attempt++;
            const baseName = name.replace(/\(\d+\)$/, "");
            name = `${baseName}(${attempt})`;
            dirPath = path.join(baseDir, name);
          } else throw e;
        }
      }
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
    case "rename": {
      const renamePath = params?.path || params?.target;
      const newName = params?.newName || params?.name;
      if (!renamePath || !newName) throw new Error("path and newName required");
      const src = fullPath(renamePath);
      const dir = path.dirname(src);
      const dest = path.join(dir, newName);
      if (!src.startsWith(WORKSPACE) || !dest.startsWith(WORKSPACE)) throw new Error("Access denied");
      await fs.rename(src, dest);
      const newRel = path.join(path.dirname(renamePath), newName).replace(/\\/g, "/");
      return { success: true, action: "rename", path: renamePath, newPath: newRel };
    }
    case "copy": {
      const copyFrom = params?.from || params?.source;
      const copyTo = params?.to || params?.destination;
      if (!copyFrom || !copyTo) throw new Error("from and to paths required");
      const src = fullPath(copyFrom);
      const dest = fullPath(copyTo);
      if (!src.startsWith(WORKSPACE) || !dest.startsWith(WORKSPACE)) throw new Error("Access denied");
      const srcStat = await fs.stat(src);
      if (srcStat.isDirectory()) {
        await fs.cp(src, dest, { recursive: true });
      } else {
        await fs.copyFile(src, dest);
      }
      return { success: true, action: "copy", from: copyFrom, to: copyTo };
    }
    case "info": {
      let infoPath = params?.path || params?.target;
      if (!infoPath) throw new Error("path required");
      if (!infoPath.includes("/") && !infoPath.includes("\\") && base) {
        infoPath = path.join(base, infoPath).replace(/\\/g, "/");
      }
      const fp = fullPath(infoPath);
      if (!fp.startsWith(WORKSPACE)) throw new Error("Access denied");
      const stat = await fs.stat(fp).catch(() => null);
      if (!stat) throw new Error("Not found");
      const name = path.basename(fp);
      let size = null;
      let itemCount = null;
      if (stat.isFile()) {
        size = stat.size;
      } else {
        const entries = await fs.readdir(fp).catch(() => []);
        itemCount = entries.length;
      }
      const relPath = path.relative(WORKSPACE, fp).replace(/\\/g, "/");
      return {
        success: true,
        action: "info",
        path: relPath,
        name,
        size,
        itemCount,
        isDirectory: stat.isDirectory(),
        modified: stat.mtime?.toISOString?.(),
        created: (stat.birthtime && stat.birthtime.getTime() !== 0 ? stat.birthtime : stat.ctime)?.toISOString?.(),
      };
    }
    case "organize": {
      const orgType = (params?.type || params?.category || "").toLowerCase();
      const p = fullPath(base);
      if (!p.startsWith(WORKSPACE)) throw new Error("Access denied");
      const entries = await fs.readdir(p, { withFileTypes: true });
      const files = entries.filter((e) => !e.name.startsWith(".") && e.isFile());

      // Organize images: create Images folder and move all image files
      if (orgType === "images" || orgType === "image" || orgType === "photos" || orgType === "pictures") {
        const imgExt = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp"]);
        const images = files.filter((f) => imgExt.has(path.extname(f.name).toLowerCase()));
        if (images.length === 0) return { success: true, action: "organize", message: "No images to organize", moved: 0 };
        const imagesDir = path.join(p, "Images");
        await fs.mkdir(imagesDir, { recursive: true });
        let moved = 0;
        for (const img of images) {
          const src = path.join(p, img.name);
          const dest = path.join(imagesDir, img.name);
          await fs.rename(src, dest);
          moved++;
        }
        return { success: true, action: "organize", folder: "Images", moved, message: `Moved ${moved} image(s) to Images folder` };
      }

      // General organize: use AI suggestions and execute
      const fileList = files.map((f) => ({ name: f.name, type: "file", size: null }));
      const dirs = entries.filter((e) => !e.name.startsWith(".") && e.isDirectory()).map((e) => ({ name: e.name, type: "directory" }));
      if (fileList.length === 0) return { success: true, action: "organize", message: "No files to organize", created: 0 };
      const suggestions = await getSmartSuggestions([...fileList, ...dirs], apiKey);
      const folderSuggestions = suggestions.folderSuggestions || [];
      let totalMoved = 0;
      for (const s of folderSuggestions) {
        if (!s?.folder || !Array.isArray(s.files) || s.files.length === 0) continue;
        const folderPath = path.join(p, s.folder);
        await fs.mkdir(folderPath, { recursive: true });
        for (const f of s.files) {
          const src = path.join(p, f);
          try {
            const destStat = await fs.stat(src).catch(() => null);
            if (destStat) {
              await fs.rename(src, path.join(folderPath, f));
              totalMoved++;
            }
          } catch {}
        }
      }
      return {
        success: true,
        action: "organize",
        message: folderSuggestions.length ? `Created ${folderSuggestions.length} folder(s), moved ${totalMoved} file(s)` : "No organization suggestions",
        created: folderSuggestions.length,
        moved: totalMoved,
      };
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

function matchesQuery(name, q) {
  const n = name.toLowerCase();
  const ql = q.toLowerCase();
  if (n.includes(ql)) return true;
  const words = n.replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((w) => w.length > 0);
  const initials = words.map((w) => w[0]).join("");
  return initials === ql || initials.includes(ql);
}

async function searchRecursive(dirPath, query, base = "") {
  const items = [];
  const entries = await fs.readdir(dirPath, { withFileTypes: true }).catch(() => []);
  for (const ent of entries) {
    if (ent.name.startsWith(".")) continue;
    const rel = path.join(base, ent.name).replace(/\\/g, "/");
    if (matchesQuery(ent.name, query)) {
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

const MAX_IMAGES = 8;

async function semanticMatch(items, query, apiKey) {
  if (items.length === 0) return [];
  const files = items.filter((i) => i.type === "file").slice(0, 80);
  const dirs = items.filter((i) => i.type === "directory");
  const textParts = [];
  const imageInfos = [];
  for (const f of files) {
    const info = await getFileContentInfo(f.path);
    if (!info) {
      textParts.push(`PATH: ${f.path} | NAME: ${f.name} | (no content)`);
      continue;
    }
    if (info.type === "pdf" && info.text) {
      textParts.push(`PATH: ${f.path} | PDF content:\n${info.text.slice(0, 1500)}`);
    } else if (info.type === "text" && info.text) {
      textParts.push(`PATH: ${f.path} | Text content:\n${info.text.slice(0, 1000)}`);
    } else if (info.type === "image" && info.base64 && imageInfos.length < MAX_IMAGES) {
      imageInfos.push({ path: f.path, base64: info.base64, mime: info.mime || "image/jpeg" });
      textParts.push(`PATH: ${f.path} | IMAGE (see image ${imageInfos.length} below)`);
    } else {
      textParts.push(`PATH: ${f.path} | NAME: ${f.name}`);
    }
  }
  const dirList = dirs.map((d) => `PATH: ${d.path} (folder)`).join("\n");
  let prompt = `User is searching for: "${query}"

STRICT matching rules:
- Only return paths that STRONGLY match. When unsure, return FEWER or NONE.
- "cat meme" = funny cat image with text/overlay/joke, NOT just any cat photo
- "letter of recommendation" = PDF containing that phrase, not random documents
- Prefer quality over quantity. Empty matches [] is better than wrong matches.
- Use exact PATH strings from the list below.

Files (with content where available):
${textParts.join("\n\n")}
${dirList ? `\nFolders: ${dirList}` : ""}

Return JSON only: {"matches": ["path1", "path2", ...]} - exact PATH strings, or [] if none strongly match.`;
  const parts = [{ text: prompt }];
  for (const img of imageInfos) {
    parts.push({
      inlineData: { mimeType: img.mime, data: img.base64 },
    });
  }
  let parsed;
  try {
    parsed = await callGeminiWithParts(parts, apiKey);
  } catch (e) {
    parsed = await callGemini(prompt, apiKey);
  }
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
    const { query, currentPath, items: providedItems } = await request.json();
    if (!query || typeof query !== "string") {
      return NextResponse.json({ error: "query required" }, { status: 400 });
    }

    const base = currentPath || "";
    const dirPath = fullPath(base);
    let fileList = providedItems;
    if (!Array.isArray(fileList) || fileList.length === 0) {
      const entries = await fs.readdir(dirPath, { withFileTypes: true }).catch(() => []);
      fileList = entries.filter((e) => !e.name.startsWith(".")).map((e) => ({
        path: path.join(base, e.name).replace(/\\/g, "/"),
        name: e.name,
        type: e.isDirectory() ? "directory" : "file",
      }));
    }
    let rootList = [];
    if (base) {
      const rootEntries = await fs.readdir(fullPath(""), { withFileTypes: true }).catch(() => []);
      rootList = rootEntries.filter((e) => !e.name.startsWith(".")).map((e) => ({
        path: e.name,
        name: e.name,
        type: e.isDirectory() ? "directory" : "file",
      }));
    }
    const combined = base ? [...new Map([...rootList.map((f) => [f.path, f]), ...fileList.map((f) => [f.path, f])]).values()] : fileList;
    const listStr = combined.length > 0 ? combined.map((f) => `- ${f.path} (${f.type})`).join("\n") : "(folder empty)";

    const systemPrompt = `You are a file organizer assistant. Current path: "${base || "(root)"}"
Existing files/folders:
${listStr}

RULES:
- Use EXACT paths from the list above. Typos like "mdhv2" -> match to "madhav2". "madhv" -> "madhav".
- "Move X to new workspace Y" or "move X into new folder Y" = create_folder Y, then move X to Y/X. Return steps.
- For duplicate folder names, use suffix: "folder(2)", "folder(3)" when name exists.
- Paths are relative to workspace root.

ACTIONS (respond with JSON only, no markdown):
Single action: {"action": "name", "params": {...}}
Multi-step: {"steps": [{"action": "create_folder", "params": {"name": "X"}}, {"action": "move", "params": {"from": "a", "to": "X/a"}}]}

1. list - Params: {}
2. create_folder - Params: {"name": "folder_name"} (if exists, use "name(2)")
3. move - Params: {"from": "source_path", "to": "dest_path"}
4. copy - Params: {"from": "source_path", "to": "dest_path"}
5. delete - Params: {"path": "path_to_delete"}
6. rename - Params: {"path": "path", "newName": "new_name"}
7. info - Params: {"path": "path_to_file"}
8. search - Params: {"query": "search_term"}
9. semantic_search - Params: {"query": "description"}
10. suggest - Params: {}
11. organize - Params: {"type": "images"} or {} for general

Respond ONLY with valid JSON: {"action": "...", "params": {...}} OR {"steps": [...]}`;

    const userPrompt = `User request: "${query}"`;
    const fullPrompt = `${systemPrompt}\n\n${userPrompt}`;

    const parsed = await callGemini(fullPrompt, apiKey);
    const steps = Array.isArray(parsed?.steps) ? parsed.steps : null;
    const action = parsed?.action?.toLowerCase?.() || parsed?.action;
    const params = parsed?.params || {};

    if (steps && steps.length > 0) {
      const results = [];
      for (const step of steps) {
        const act = (step.action || "").toLowerCase();
        const prm = step.params || {};
        try {
          const r = await executeAction(act, prm, currentPath, apiKey);
          results.push(r);
        } catch (e) {
          results.push({ error: e.message, action: act });
          throw e;
        }
      }
      return NextResponse.json({
        success: true,
        action: "multi_step",
        steps: results,
        count: results.length,
      });
    }

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
