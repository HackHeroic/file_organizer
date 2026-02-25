import { NextResponse } from "next/server";
import path from "path";
import fs from "fs/promises";
import { getFileContentInfo } from "../lib/content-analysis";
import { readMeta, writeMeta } from "../meta-util";

const WORKSPACE = process.env.WORKSPACE_PATH || path.join(process.cwd(), "workspace");
const GEMINI_API = "https://generativelanguage.googleapis.com/v1beta/models";

function safePath(rel) {
  return path.normalize(rel || "").replace(/^(\.\.(\/|\\|$))+/, "");
}

function fullPath(rel) {
  return path.join(WORKSPACE, safePath(rel));
}

const FALLBACK_MODEL = "gemini-1.5-flash";

// Filler phrases that mean "also/too" — never treat as folder names
const FILLER_PHRASES = new Set(["as well", "too", "also", "please", "thanks", "pls", "thx", "ok", "aswell"]);
function isFillerPhrase(s) {
  return s && FILLER_PHRASES.has(String(s).toLowerCase().trim());
}

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
      const createdRelPath = path.join(base, name).replace(/\\/g, "/");
      // When creating a top-level folder (new workspace), register it in userWorkspaces so it appears in the sidebar
      if (!base || base === "" || !base.includes("/")) {
        const topLevelName = createdRelPath.split("/")[0];
        if (topLevelName && /^[^/\\<>:"|?*]+$/.test(topLevelName)) {
          const data = await readMeta().catch(() => ({}));
          const userWorkspaces = data.userWorkspaces || [];
          if (!userWorkspaces.includes(topLevelName)) {
            userWorkspaces.push(topLevelName);
            await writeMeta({ ...data, userWorkspaces });
          }
        }
      }
      return { success: true, action: "create_folder", path: createdRelPath };
    }
    case "move": {
      const from = params?.from || params?.source;
      const to = params?.to || params?.destination;
      if (!from || !to) throw new Error("from and to paths required");
      const src = fullPath(from);
      const dest = fullPath(to);
      if (!src.startsWith(WORKSPACE) || !dest.startsWith(WORKSPACE)) throw new Error("Access denied");
      const destDir = path.dirname(dest);
      await fs.mkdir(destDir, { recursive: true });
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
      await fs.mkdir(dir, { recursive: true });
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
      const destDir = path.dirname(dest);
      await fs.mkdir(destDir, { recursive: true });
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
      if (!infoPath) {
        infoPath = base || "";
      }
      if (!infoPath.includes("/") && !infoPath.includes("\\") && base && infoPath) {
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
      const seen = new Set();
      const deduped = results.filter((r) => {
        const p = (r.path || "").replace(/\\/g, "/");
        if (seen.has(p)) return false;
        seen.add(p);
        return true;
      });
      return { success: true, action: "search", items: deduped, count: deduped.length };
    }
    case "semantic_search": {
      const q = params?.query || params?.q || "";
      if (!q) throw new Error("search query required");
      const searchRoot = fullPath(base);
      if (!searchRoot.startsWith(WORKSPACE)) throw new Error("Access denied");
      const allItems = await listAllFilesRecursive(searchRoot, base || "");
      if (allItems.length === 0) return { success: true, action: "semantic_search", items: [], count: 0 };
      const matched = await semanticMatch(allItems, q, apiKey);
      const seenSem = new Set();
      const dedupedMatch = matched.filter((r) => {
        const p = (r.path || "").replace(/\\/g, "/");
        if (seenSem.has(p)) return false;
        seenSem.add(p);
        return true;
      });
      return { success: true, action: "semantic_search", items: dedupedMatch, count: dedupedMatch.length };
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
    case "navigate":
    case "open": {
      let navPath = params?.path || params?.target || "";
      if (!navPath.includes("/") && !navPath.includes("\\") && base && navPath) {
        navPath = path.join(base, navPath).replace(/\\/g, "/");
      }
      const fp = fullPath(navPath);
      if (!fp.startsWith(WORKSPACE)) throw new Error("Access denied");
      const navStat = await fs.stat(fp).catch(() => null);
      if (!navStat) throw new Error("Not found: " + navPath);
      if (!navStat.isDirectory()) {
        const parentDir = path.dirname(navPath);
        return {
          success: true,
          action: "navigate",
          path: parentDir === "." ? "" : parentDir,
          message: `That's a file, not a folder. Navigating to its parent folder.`,
          selectFile: navPath,
        };
      }
      return { success: true, action: "navigate", path: navPath };
    }
    case "add_favorite": {
      const favPath = params?.path || params?.target;
      if (!favPath) throw new Error("path required");
      const data = await readMeta();
      if (!data.meta) data.meta = {};
      if (!data.meta[favPath]) data.meta[favPath] = {};
      data.meta[favPath].starred = true;
      await writeMeta(data);
      return { success: true, action: "add_favorite", path: favPath, message: `Added "${favPath}" to favorites` };
    }
    case "remove_favorite": {
      const unfavPath = params?.path || params?.target;
      if (!unfavPath) throw new Error("path required");
      const data = await readMeta();
      if (data.meta?.[unfavPath]) {
        data.meta[unfavPath].starred = false;
        await writeMeta(data);
      }
      return { success: true, action: "remove_favorite", path: unfavPath, message: `Removed "${unfavPath}" from favorites` };
    }
    case "add_tag": {
      const tagPath = params?.path || params?.target;
      const tagName = params?.tag || params?.name;
      if (!tagPath || !tagName) throw new Error("path and tag required");
      const data = await readMeta();
      if (!data.meta) data.meta = {};
      if (!data.meta[tagPath]) data.meta[tagPath] = {};
      const tags = data.meta[tagPath].tags || [];
      if (!tags.includes(tagName)) tags.push(tagName);
      data.meta[tagPath].tags = tags;
      await writeMeta(data);
      return { success: true, action: "add_tag", path: tagPath, tag: tagName, message: `Added tag "${tagName}" to "${tagPath}"` };
    }
    case "add_comment": {
      const commentPath = params?.path || params?.target;
      const comment = params?.comment || params?.text;
      if (!commentPath || !comment) throw new Error("path and comment required");
      const data = await readMeta();
      if (!data.meta) data.meta = {};
      if (!data.meta[commentPath]) data.meta[commentPath] = {};
      data.meta[commentPath].comments = comment;
      await writeMeta(data);
      return { success: true, action: "add_comment", path: commentPath, message: `Added comment to "${commentPath}"` };
    }
    case "suggest_ai_tags": {
      const tagsPath = params?.path || params?.target;
      if (!tagsPath) throw new Error("path required");
      return { success: true, action: "suggest_ai_tags", path: tagsPath, message: "Use the AI Suggest Tags button in the info panel" };
    }
    case "suggest_ai_comment": {
      const cPath = params?.path || params?.target;
      if (!cPath) throw new Error("path required");
      return { success: true, action: "suggest_ai_comment", path: cPath, message: "Use the AI Suggest Comment button in the info panel" };
    }
    case "remove_duplicates":
    case "merge_duplicates": {
      const p = fullPath(base);
      if (!p.startsWith(WORKSPACE)) throw new Error("Access denied");
      const entries = await fs.readdir(p, { withFileTypes: true });
      const fileList = [];
      for (const ent of entries) {
        if (ent.name.startsWith(".")) continue;
        const fp2 = path.join(p, ent.name);
        const s = await fs.stat(fp2).catch(() => null);
        fileList.push({ name: ent.name, type: ent.isDirectory() ? "directory" : "file", size: s?.isFile() ? s.size : null });
      }
      const suggestions = await getSmartSuggestions(fileList, apiKey);
      let duplicates = suggestions.duplicates || [];
      const nameToItem = new Map(fileList.map((f) => [f.name, f]));
      const baseNameGroups = new Map();
      for (const f of fileList) {
        const baseMatch = f.name.match(/^(.+?)\s*\(\d+\)\s*$/);
        const baseName = baseMatch ? baseMatch[1].trim().toLowerCase() : f.name.toLowerCase();
        if (!baseNameGroups.has(baseName)) baseNameGroups.set(baseName, []);
        baseNameGroups.get(baseName).push(f.name);
      }
      for (const [, names] of baseNameGroups) {
        if (names.length >= 2) {
          const sorted = [...names].sort((a, b) => {
            const aHasCopy = /\(\d+\)\s*$/.test(a);
            const bHasCopy = /\(\d+\)\s*$/.test(b);
            if (!aHasCopy && bHasCopy) return -1;
            if (aHasCopy && !bHasCopy) return 1;
            return a.localeCompare(b);
          });
          if (!duplicates.some((grp) => Array.isArray(grp) && grp.length >= 2 && grp.every((n) => names.includes(n)))) {
            duplicates.push(sorted);
          }
        }
      }
      if (duplicates.length === 0) return { success: true, action: "remove_duplicates", message: "No duplicates found", removed: 0 };
      let removed = 0;
      for (const grp of duplicates) {
        if (!Array.isArray(grp) || grp.length < 2) continue;
        for (let i = 1; i < grp.length; i++) {
          const fp2 = path.join(p, grp[i]);
          try {
            const st = await fs.stat(fp2).catch(() => null);
            if (!st) continue;
            if (st.isDirectory()) {
              await fs.rm(fp2, { recursive: true, force: true });
            } else {
              await fs.unlink(fp2);
            }
            removed++;
          } catch {}
        }
      }
      return { success: true, action: "remove_duplicates", message: `Removed ${removed} duplicate(s)`, removed, duplicates };
    }
    case "directory_size":
    case "total_size": {
      let sizePath = params?.path || params?.target || base || "";
      const fp = fullPath(sizePath);
      if (!fp.startsWith(WORKSPACE)) throw new Error("Access denied");
      async function getDirSize(dir) {
        let total = 0;
        const entries2 = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
        for (const ent of entries2) {
          const p2 = path.join(dir, ent.name);
          if (ent.isFile()) { const s = await fs.stat(p2).catch(() => null); if (s) total += s.size; }
          else if (ent.isDirectory()) total += await getDirSize(p2);
        }
        return total;
      }
      const totalBytes = await getDirSize(fp);
      const units = ["B", "KB", "MB", "GB"];
      let idx = 0, sz = totalBytes;
      while (sz >= 1024 && idx < units.length - 1) { sz /= 1024; idx++; }
      return { success: true, action: "directory_size", path: sizePath, size: `${sz.toFixed(1)} ${units[idx]}`, sizeBytes: totalBytes };
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
- Use EXACT paths from the list above. For typos: "mdhv2" -> "madhav2", "madhv" -> "madhav". Match closest name.
- "Move X to new workspace Y" or "move X into new workspace Y" = create_folder Y, then move X to Y/X. Return steps.
- NEVER use "as well", "too", "also", "please", "thanks" as folder names — these are filler words meaning "also". E.g. "move nst to new workspace as well" = move nst to new workspace (intelligent naming), NOT create folder "as well".
- "Move X to new workspace" (no name given) = INTELLIGENT naming: use SOURCE name (X). If moving a FOLDER named X, use "X Workspace" (e.g. "tyagi Workspace") to avoid moving a folder into itself on case-insensitive FS. If moving a file, use parent folder or "Documents" as workspace. Never use literal "new workspace" or a name that equals the source path (case-insensitive).
- For duplicate folder names, use suffix: "folder(2)", "folder(3)" when name exists.
- create_folder creates a folder INSIDE the current path ("${base || "(root)"}"). So {"name":"Audio"} creates "${base ? base + "/Audio" : "Audio"}".
- move and copy paths are ALWAYS workspace-root-relative. After create_folder inside "${base || "(root)"}", move destinations MUST use the full path: e.g. "${base ? base + "/Audio/song.mp3" : "Audio/song.mp3"}", NOT just "Audio/song.mp3" if you are already inside a subfolder.
- IMPORTANT: When organizing/classifying files inside "${base || "(root)"}", every move destination must be prefixed with "${base ? base + "/" : ""}".

EXAMPLE (classify inside folder "madhav"):
  Current path: "madhav"
  Files: song.mp3, photo.jpg
  Steps: [
    {"action":"create_folder","params":{"name":"Audio"}},
    {"action":"create_folder","params":{"name":"Images"}},
    {"action":"move","params":{"from":"madhav/song.mp3","to":"madhav/Audio/song.mp3"}},
    {"action":"move","params":{"from":"madhav/photo.jpg","to":"madhav/Images/photo.jpg"}}
  ]

COMMAND MAPPINGS:
- "show info" or "get info" without a target → {"action":"info","params":{}} (shows current folder info)
- "show info on X" / "info about X" → {"action":"info","params":{"path":"X"}}
- "remove/merge/delete/clean duplicates" → {"action":"remove_duplicates","params":{}}
- "find duplicates" → {"action":"suggest","params":{}}
- "what's here" / "list contents" / "list files" → {"action":"list","params":{}}
- "find photos/images" → {"action":"search","params":{"query":"photos"}} (filters by image extensions)
- "find audio/music/songs" → {"action":"search","params":{"query":"audio"}} (filters by audio extensions)
- "find videos" → {"action":"search","params":{"query":"videos"}} (filters by video extensions)
- "find PDFs/documents" → {"action":"search","params":{"query":"pdfs"}} (filters by document extensions)
- "open X" / "go to X" / "navigate to X" → {"action":"navigate","params":{"path":"X"}}
- SIZE: If user asks size of a specific FILE (e.g. "Chin Tapak Dam Dam.mp3 its size?", "how big is report.pdf") → {"action":"info","params":{"path":"exact_file_path"}} to get file size. If user asks size of a FOLDER or "this directory" / "current folder" → {"action":"directory_size","params":{"path":"X"}} or {} for current folder.
- "favorite X" / "star X" / "add X to favorites" → {"action":"add_favorite","params":{"path":"X"}}
- "add tag Y to X" → {"action":"add_tag","params":{"path":"X","tag":"Y"}}
- "add comment to X" → {"action":"add_comment","params":{"path":"X","comment":"text"}}
- "suggest tags" / "AI tags" → {"action":"suggest_ai_tags","params":{"path":"target"}}
- "classify" / "organize by type" / "sort into folders" → organize with create_folder + move steps
- "copy X to Y" / "copy X into Y" → {"action":"copy","params":{"from":"X_path","to":"Y_path/X_name"}}
- "move X to Y" / "move X into Y" → {"action":"move","params":{"from":"X_path","to":"Y_path/X_name"}}
- "duplicate X" / "copy X here" → copy X into current folder (same directory, use name(2) if exists)
- "move X here" → move X into current folder
- "move X to new workspace" / "move X to a new workspace" (no name) → create_folder with name = X (source), then move X into it. Workspace name comes from the item being moved.
- "as well", "too", "also" at end of commands = filler words (ignore). "move X to new workspace as well" = same as "move X to new workspace". NEVER create folders named "as well", "too", "also".

ACTIONS (respond with JSON only, no markdown):
Single action: {"action": "name", "params": {...}}
Multi-step: {"steps": [{"action": "create_folder", "params": {"name": "X"}}, {"action": "move", "params": {"from": "currentPath/a", "to": "currentPath/X/a"}}]}

1. list - Params: {}
2. create_folder - Params: {"name": "folder_name"} (creates inside current path; if exists, use "name(2)")
3. move - Params: {"from": "source_path", "to": "dest_path"} (workspace-root-relative paths)
4. copy - Params: {"from": "source_path", "to": "dest_path"} (workspace-root-relative paths)
5. delete - Params: {"path": "path_to_delete"}
6. rename - Params: {"path": "path", "newName": "new_name"}
7. info - Params: {"path": "path_to_file"} or {} for current folder
8. search - Params: {"query": "search_term"} (find by name)
9. semantic_search - Params: {"query": "description"} (find by content/meaning: photos, PDFs, documents)
10. suggest - Params: {} (AI organization suggestions, no action taken)
11. organize - Params: {"type": "images"} or {} for general (creates folders and moves files)
12. navigate - Params: {"path": "target_path"} (open/go to a folder)
13. add_favorite - Params: {"path": "target_path"} (star/favorite a file or folder)
14. add_tag - Params: {"path": "target_path", "tag": "tag_name"}
15. add_comment - Params: {"path": "target_path", "comment": "comment_text"}
16. remove_duplicates - Params: {} (find and remove duplicate files)
17. directory_size - Params: {"path": "target_path"} or {} for current folder (get total size)

CRITICAL: Respond with ONLY valid JSON—no markdown code blocks, no explanation, no extra text. Valid responses are exactly: {"action": "action_name", "params": {...}} OR {"steps": [{"action": "...", "params": {...}}, ...]}. Use only action names from the list above. If the user intent is unclear, prefer "list" to show the current folder.`;

    let queryLower = query.toLowerCase().trim();
    // Strip filler phrases so they're not mistaken for folder names
    queryLower = queryLower.replace(/\s+(as\s+well|too|also|please|thanks|pls|thx)\s*$/gi, "").trim();
    queryLower = queryLower.replace(/^(please|pls|kindly)\s+/gi, "").trim();

    if (queryLower === "show info" || queryLower === "get info") {
      return NextResponse.json({
        success: true,
        action: "info",
        path: base || "",
        name: base ? base.split("/").pop() : "(root)",
      });
    }
    if (/^(remove|merge|delete|clean)\s+duplicates?$/i.test(queryLower) || /^remove\s+dupl[iy]cates$/i.test(queryLower)) {
      const result = await executeAction("remove_duplicates", {}, base, apiKey);
      return NextResponse.json(result);
    }
    if (/^find\s+duplicates$/i.test(queryLower)) {
      const result = await executeAction("suggest", {}, base, apiKey);
      return NextResponse.json(result);
    }
    if (/^(what'?s here|list contents|list files|list|refresh|reload)$/i.test(queryLower)) {
      const result = await executeAction("list", {}, base, apiKey);
      return NextResponse.json(result);
    }

    // "contents of X" / "list contents of X" / "what's in X" — list that folder reliably (no AI)
    const contentsOfMatch = queryLower.match(/^(?:contents?|list|show)\s+(?:contents?\s+)?(?:of|in)\s+(.+)$/i)
      || queryLower.match(/^what'?s?\s+in\s+(.+)$/i)
      || queryLower.match(/^what\s+is\s+in\s+(.+)$/i);
    if (contentsOfMatch) {
      const targetName = (contentsOfMatch[1] || "").trim().replace(/^["']|["']$/g, "");
      if (targetName) {
        const allCombined = combined;
        const dirMatch = allCombined.find((f) => f.type === "directory" && f.name.toLowerCase() === targetName.toLowerCase())
          || allCombined.find((f) => f.type === "directory" && f.path.replace(/\\/g, "/").toLowerCase().endsWith("/" + targetName.toLowerCase()))
          || allCombined.find((f) => f.type === "directory" && f.name.toLowerCase().includes(targetName.toLowerCase()));
        if (dirMatch) {
          const listPath = dirMatch.path.replace(/\\/g, "/");
          const result = await executeAction("list", {}, listPath, apiKey);
          return NextResponse.json(result);
        }
      }
    }

    if (/^(?:total\s+)?size\s+of\s+(?:this|the|current)\s+(?:directory|folder|path)?\s*$|^(?:this|the|current)\s+(?:directory|folder)?\s*size\s*$|how\s+big\s+is\s+(?:this|the|current)\s+(?:directory|folder)?\s*$/i.test(queryLower)) {
      const result = await executeAction("directory_size", { path: base || "" }, base, apiKey);
      return NextResponse.json(result);
    }

    const fileSizeMatch = queryLower.match(/^(.+?)\s+its?\s+size\s*\??\s*$/) ||
      queryLower.match(/(?:what'?s?|what is)\s+(?:the )?size of\s+(.+?)\s*\??\s*$/);
    if (fileSizeMatch) {
      const rawTarget = (fileSizeMatch[1] || "").trim();
      if (rawTarget) {
        let resolvedPath = rawTarget.replace(/\\/g, "/");
        if (!resolvedPath.includes("/") && base) resolvedPath = path.join(base, resolvedPath).replace(/\\/g, "/");
        let allCombined = combined;
        let match = allCombined.find((f) => (f.path || "").replace(/\\/g, "/") === resolvedPath)
                 || allCombined.find((f) => f.name.toLowerCase() === rawTarget.toLowerCase())
                 || allCombined.find((f) => (f.path || "").toLowerCase().includes(rawTarget.toLowerCase()));
        if (!match) {
          const currentDirPath = fullPath(base);
          const entries = await fs.readdir(currentDirPath, { withFileTypes: true }).catch(() => []);
          const allHere = entries.filter((e) => !e.name.startsWith(".")).map((e) => ({
            path: path.join(base, e.name).replace(/\\/g, "/"),
            name: e.name,
            type: e.isDirectory() ? "directory" : "file",
          }));
          match = allHere.find((f) => f.path === resolvedPath || f.name.toLowerCase() === rawTarget.toLowerCase())
               || allHere.find((f) => f.path.toLowerCase().endsWith(rawTarget.toLowerCase()));
        }
        if (match) {
          const result = await executeAction(match.type === "directory" ? "directory_size" : "info", { path: match.path }, base, apiKey);
          return NextResponse.json(result);
        }
        const fp = fullPath(resolvedPath);
        if (fp.startsWith(WORKSPACE)) {
          const stat = await fs.stat(fp).catch(() => null);
          if (stat) {
            const result = await executeAction(stat.isDirectory() ? "directory_size" : "info", { path: resolvedPath }, base, apiKey);
            return NextResponse.json(result);
          }
        }
      }
    }

    const findByExtension = queryLower.match(/^find\s+(?:my\s+|all\s+)?(photos?|images?|pictures?|audio|music|songs?|videos?|movies?|pdfs?|documents?|docs)$/i);
    if (findByExtension) {
      const category = findByExtension[1].toLowerCase();
      const extMap = {
        photo: [".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".svg", ".heic"],
        photos: [".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".svg", ".heic"],
        image: [".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".svg", ".heic"],
        images: [".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".svg", ".heic"],
        picture: [".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".svg", ".heic"],
        pictures: [".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".svg", ".heic"],
        audio: [".mp3", ".wav", ".m4a", ".ogg", ".flac", ".aac", ".wma", ".opus", ".aiff"],
        music: [".mp3", ".wav", ".m4a", ".ogg", ".flac", ".aac", ".wma", ".opus", ".aiff"],
        song: [".mp3", ".wav", ".m4a", ".ogg", ".flac", ".aac", ".wma", ".opus", ".aiff"],
        songs: [".mp3", ".wav", ".m4a", ".ogg", ".flac", ".aac", ".wma", ".opus", ".aiff"],
        video: [".mp4", ".mov", ".avi", ".mkv", ".webm", ".wmv", ".flv"],
        videos: [".mp4", ".mov", ".avi", ".mkv", ".webm", ".wmv", ".flv"],
        movie: [".mp4", ".mov", ".avi", ".mkv", ".webm", ".wmv", ".flv"],
        movies: [".mp4", ".mov", ".avi", ".mkv", ".webm", ".wmv", ".flv"],
        pdf: [".pdf"],
        pdfs: [".pdf"],
        document: [".pdf", ".doc", ".docx", ".txt", ".rtf", ".odt", ".xls", ".xlsx", ".ppt", ".pptx"],
        documents: [".pdf", ".doc", ".docx", ".txt", ".rtf", ".odt", ".xls", ".xlsx", ".ppt", ".pptx"],
        docs: [".pdf", ".doc", ".docx", ".txt", ".rtf", ".odt", ".xls", ".xlsx", ".ppt", ".pptx"],
      };
      const exts = extMap[category] || [];
      if (exts.length > 0) {
        const searchRoot = fullPath("");
        const allItems = await listAllFilesRecursive(searchRoot, "");
        const extSet = new Set(exts);
        const matched = allItems.filter((i) => i.type === "file" && extSet.has(path.extname(i.name).toLowerCase()));
        const seenExt = new Set();
        const dedupedExt = matched.filter((r) => {
          const p = (r.path || "").replace(/\\/g, "/");
          if (seenExt.has(p)) return false;
          seenExt.add(p);
          return true;
        });
        return NextResponse.json({
          success: true,
          action: "search",
          items: dedupedExt,
          count: dedupedExt.length,
        });
      }
    }

    const openMatch = queryLower.match(/^(open|go\s+to|navigate\s+to|cd|enter|show\s+me)\s+(.+)$/i);
    if (openMatch) {
      const target = openMatch[2].replace(/^(folder|directory|dir|the)\s+/i, "").trim();
      if (target) {
        const allCombined = combined;
        let exactMatch = allCombined.find((f) => f.type === "directory" && f.name.toLowerCase() === target.toLowerCase());
        let partialMatch = !exactMatch && allCombined.find((f) => f.type === "directory" && f.name.toLowerCase().includes(target.toLowerCase()));
        let match = exactMatch || partialMatch;
        if (!match) {
          const currentDirPath = fullPath(base);
          const entries = await fs.readdir(currentDirPath, { withFileTypes: true }).catch(() => []);
          const dirs = entries.filter((e) => !e.name.startsWith(".") && e.isDirectory()).map((e) => ({
            path: path.join(base, e.name).replace(/\\/g, "/"),
            name: e.name,
            type: "directory",
          }));
          exactMatch = dirs.find((f) => f.name.toLowerCase() === target.toLowerCase());
          partialMatch = !exactMatch && dirs.find((f) => f.name.toLowerCase().includes(target.toLowerCase()));
          match = exactMatch || partialMatch;
        }
        if (match) {
          const result = await executeAction("navigate", { path: match.path }, base, apiKey);
          return NextResponse.json(result);
        }
      }
    }

    const sizeMatch = queryLower.match(/(?:size|how (?:big|large|much space)|total size|directory size|folder size)(?:\s+(?:of|for))?\s*(.*)?$/i);
    if (sizeMatch) {
      let target = (sizeMatch[1] || "").replace(/^(this|the|current)\s+(directory|folder|path)?\s*/i, "").trim();
      if (!target || /^(this|the|current)?\s*(directory|folder|path)?$/i.test(target)) {
        const result = await executeAction("directory_size", { path: base || "" }, base, apiKey);
        return NextResponse.json(result);
      }
      let allCombined = combined;
      let dirMatch = allCombined.find((f) => f.type === "directory" && f.name.toLowerCase() === target.toLowerCase());
      let partialDirMatch = !dirMatch && allCombined.find((f) => f.type === "directory" && f.name.toLowerCase().includes(target.toLowerCase()));
      let m = dirMatch || partialDirMatch;
      if (!m) {
        const currentDirPath = fullPath(base);
        const entries = await fs.readdir(currentDirPath, { withFileTypes: true }).catch(() => []);
        const dirs = entries.filter((e) => !e.name.startsWith(".") && e.isDirectory()).map((e) => ({
          path: path.join(base, e.name).replace(/\\/g, "/"),
          name: e.name,
          type: "directory",
        }));
        dirMatch = dirs.find((f) => f.name.toLowerCase() === target.toLowerCase());
        partialDirMatch = !dirMatch && dirs.find((f) => f.name.toLowerCase().includes(target.toLowerCase()));
        m = dirMatch || partialDirMatch;
      }
      if (m) {
        const result = await executeAction("directory_size", { path: m.path }, base, apiKey);
        return NextResponse.json(result);
      }
      const fileMatch = allCombined.find((f) => f.name.toLowerCase() === target.toLowerCase());
      if (fileMatch) {
        const result = await executeAction("info", { path: fileMatch.path }, base, apiKey);
        return NextResponse.json(result);
      }
      const result = await executeAction("directory_size", { path: base || "" }, base, apiKey);
      return NextResponse.json(result);
    }

    const favoriteMatch = queryLower.match(/(?:add|mark|make|set)\s+(.+?)(?:\s+(?:as|to))?\s*(?:fav(?:ou?rite)?s?|star(?:red)?)$/i)
      || queryLower.match(/^(.+?)\s+(?:add\s+to|mark\s+as|make)\s*(?:fav(?:ou?rite)?s?|star(?:red)?)$/i)
      || queryLower.match(/(?:fav(?:ou?rite)?|star)\s+(.+)$/i)
      || queryLower.match(/(?:make|set)\s+(.+?)\s+my\s+fav(?:ou?rite)?$/i);
    if (favoriteMatch) {
      const target = (favoriteMatch[1] || "").trim();
      if (target) {
        let allCombined = combined;
        let match = allCombined.find((f) => f.path.toLowerCase() === target.toLowerCase())
                 || allCombined.find((f) => f.name.toLowerCase() === target.toLowerCase())
                 || allCombined.find((f) => f.path.toLowerCase().includes(target.toLowerCase()))
                 || allCombined.find((f) => f.name.toLowerCase().includes(target.toLowerCase()));
        if (!match) {
          const currentDirPath = fullPath(base);
          const entries = await fs.readdir(currentDirPath, { withFileTypes: true }).catch(() => []);
          const allHere = entries.filter((e) => !e.name.startsWith(".")).map((e) => ({
            path: path.join(base, e.name).replace(/\\/g, "/"),
            name: e.name,
            type: e.isDirectory() ? "directory" : "file",
          }));
          match = allHere.find((f) => f.name.toLowerCase() === target.toLowerCase())
               || allHere.find((f) => f.name.toLowerCase().includes(target.toLowerCase()));
        }
        if (match) {
          const result = await executeAction("add_favorite", { path: match.path }, base, apiKey);
          return NextResponse.json(result);
        }
        const result = await executeAction("add_favorite", { path: target }, base, apiKey);
        return NextResponse.json(result);
      }
    }

    const tagMatch = queryLower.match(/(?:add|set)\s+tag\s+["']?(.+?)["']?\s+(?:to|on|for)\s+(.+)$/i)
                  || queryLower.match(/tag\s+(.+?)\s+(?:as|with)\s+["']?(.+?)["']?$/i);
    if (tagMatch) {
      const [, tagOrFile, fileOrTag] = tagMatch;
      let allCombined = combined;
      let filePath, tagName;
      const matchA = allCombined.find((f) => (f.name || "").toLowerCase() === (fileOrTag || "").toLowerCase().trim());
      if (matchA) { filePath = matchA.path; tagName = (tagOrFile || "").trim(); }
      else {
        const matchB = allCombined.find((f) => (f.name || "").toLowerCase() === (tagOrFile || "").toLowerCase().trim());
        if (matchB) { filePath = matchB.path; tagName = (fileOrTag || "").trim(); }
      }
      if (!filePath && (fileOrTag || tagOrFile)) {
        const currentDirPath = fullPath(base);
        const entries = await fs.readdir(currentDirPath, { withFileTypes: true }).catch(() => []);
        const allHere = entries.filter((e) => !e.name.startsWith(".")).map((e) => ({
          path: path.join(base, e.name).replace(/\\/g, "/"),
          name: e.name,
          type: e.isDirectory() ? "directory" : "file",
        }));
        const matchC = allHere.find((f) => f.name.toLowerCase() === (fileOrTag || "").toLowerCase().trim());
        if (matchC) { filePath = matchC.path; tagName = (tagOrFile || "").trim(); }
        else {
          const matchD = allHere.find((f) => f.name.toLowerCase() === (tagOrFile || "").toLowerCase().trim());
          if (matchD) { filePath = matchD.path; tagName = (fileOrTag || "").trim(); }
        }
      }
      if (filePath && tagName) {
        const result = await executeAction("add_tag", { path: filePath, tag: tagName }, base, apiKey);
        return NextResponse.json(result);
      }
    }

    const commentMatch = queryLower.match(/(?:add|set)\s+comment\s+["']?(.+?)["']?\s+(?:to|on|for)\s+(.+)$/i)
                       || queryLower.match(/comment\s+(?:on|for)\s+(.+?)\s*[:]\s*["']?(.+?)["']?$/i);
    if (commentMatch) {
      let allCombined = combined;
      const [, part1, part2] = commentMatch;
      let fileMatch = allCombined.find((f) => (f.name || "").toLowerCase() === (part2 || "").toLowerCase().trim());
      if (fileMatch) {
        const result = await executeAction("add_comment", { path: fileMatch.path, comment: (part1 || "").trim() }, base, apiKey);
        return NextResponse.json(result);
      }
      fileMatch = allCombined.find((f) => (f.name || "").toLowerCase() === (part1 || "").toLowerCase().trim());
      if (fileMatch) {
        const result = await executeAction("add_comment", { path: fileMatch.path, comment: (part2 || "").trim() }, base, apiKey);
        return NextResponse.json(result);
      }
      const currentDirPath = fullPath(base);
      const entries = await fs.readdir(currentDirPath, { withFileTypes: true }).catch(() => []);
      const allHere = entries.filter((e) => !e.name.startsWith(".")).map((e) => ({
        path: path.join(base, e.name).replace(/\\/g, "/"),
        name: e.name,
        type: e.isDirectory() ? "directory" : "file",
      }));
      fileMatch = allHere.find((f) => f.name.toLowerCase() === (part2 || "").toLowerCase().trim());
      if (fileMatch) {
        const result = await executeAction("add_comment", { path: fileMatch.path, comment: (part1 || "").trim() }, base, apiKey);
        return NextResponse.json(result);
      }
      fileMatch = allHere.find((f) => f.name.toLowerCase() === (part1 || "").toLowerCase().trim());
      if (fileMatch) {
        const result = await executeAction("add_comment", { path: fileMatch.path, comment: (part2 || "").trim() }, base, apiKey);
        return NextResponse.json(result);
      }
    }

    const renameMatch = queryLower.match(/^rename\s+(.+?)\s+(?:to|as)\s+(.+)$/i);
    if (renameMatch) {
      const [, oldName, newName] = renameMatch;
      const allCombined = combined;
      const match = allCombined.find((f) => f.name.toLowerCase() === oldName.trim().toLowerCase())
                 || allCombined.find((f) => f.path.toLowerCase() === oldName.trim().toLowerCase())
                 || allCombined.find((f) => f.name.toLowerCase().includes(oldName.trim().toLowerCase()));
      if (match) {
        const result = await executeAction("rename", { path: match.path, newName: newName.trim() }, base, apiKey);
        return NextResponse.json(result);
      }
    }

    const deleteMatch = queryLower.match(/^(?:delete|remove|trash)\s+(.+)$/i);
    if (deleteMatch && !/duplicates?$/i.test(deleteMatch[1])) {
      const target = deleteMatch[1].trim();
      const allCombined = combined;
      const match = allCombined.find((f) => f.name.toLowerCase() === target.toLowerCase())
                 || allCombined.find((f) => f.path.toLowerCase() === target.toLowerCase())
                 || allCombined.find((f) => f.name.toLowerCase().includes(target.toLowerCase()));
      if (match) {
        const result = await executeAction("delete", { path: match.path }, base, apiKey);
        return NextResponse.json(result);
      }
    }

    const createMatch = queryLower.match(/^(?:create|make|new)\s+(?:a\s+)?folder\s+(.+)$/i);
    if (createMatch) {
      const name = createMatch[1].trim().replace(/^["']|["']$/g, "");
      const result = await executeAction("create_folder", { name }, base, apiKey);
      return NextResponse.json(result);
    }

    if (/^(?:how many|count)\s*(?:files?|items?|folders?)?/i.test(queryLower)) {
      const p = fullPath(base);
      const entries = await fs.readdir(p, { withFileTypes: true }).catch(() => []);
      const visible = entries.filter((e) => !e.name.startsWith("."));
      const files = visible.filter((e) => e.isFile()).length;
      const folders = visible.filter((e) => e.isDirectory()).length;
      return NextResponse.json({
        success: true,
        action: "info",
        message: `${visible.length} item(s): ${files} file(s), ${folders} folder(s)`,
        count: visible.length,
        files,
        folders,
      });
    }

    const infoMatch = queryLower.match(/^(?:show\s+)?info\s+(?:on|about|for|of)\s+(.+)$/i)
                   || queryLower.match(/^(?:get|what(?:'s|\s+is))\s+(?:info\s+(?:on|about|for)\s+)?(.+?)(?:\s+info)?$/i);
    if (infoMatch) {
      const target = infoMatch[1].trim();
      let allCombined = combined;
      let match = allCombined.find((f) => f.name.toLowerCase() === target.toLowerCase())
               || allCombined.find((f) => f.path.toLowerCase() === target.toLowerCase())
               || allCombined.find((f) => f.name.toLowerCase().includes(target.toLowerCase()));
      if (!match) {
        const currentDirPath = fullPath(base);
        const entries = await fs.readdir(currentDirPath, { withFileTypes: true }).catch(() => []);
        const allHere = entries.filter((e) => !e.name.startsWith(".")).map((e) => ({
          path: path.join(base, e.name).replace(/\\/g, "/"),
          name: e.name,
          type: e.isDirectory() ? "directory" : "file",
        }));
        match = allHere.find((f) => f.name.toLowerCase() === target.toLowerCase())
             || allHere.find((f) => f.name.toLowerCase().includes(target.toLowerCase()));
      }
      if (match) {
        const result = await executeAction("info", { path: match.path }, base, apiKey);
        return NextResponse.json(result);
      }
    }

    const unfavoriteMatch = queryLower.match(/(?:remove|unstar|unfav(?:ou?rite)?)\s+(.+?)(?:\s+from\s+fav(?:ou?rite)?s?)?$/i)
                         || queryLower.match(/^(.+?)\s+(?:remove\s+from|unmark)\s*(?:fav(?:ou?rite)?s?)$/i);
    if (unfavoriteMatch) {
      const target = (unfavoriteMatch[1] || "").trim();
      if (target && !/duplicates?$/i.test(target)) {
        const allCombined = combined;
        const match = allCombined.find((f) => f.path.toLowerCase() === target.toLowerCase())
                   || allCombined.find((f) => f.name.toLowerCase() === target.toLowerCase())
                   || allCombined.find((f) => f.name.toLowerCase().includes(target.toLowerCase()));
        if (match) {
          const result = await executeAction("remove_favorite", { path: match.path }, base, apiKey);
          return NextResponse.json(result);
        }
      }
    }

    // "duplicate X" / "copy X here" — copy into current folder
    const duplicateMatch = queryLower.match(/^(?:duplicate|copy)\s+(.+?)(?:\s+here)?\s*$/i);
    if (duplicateMatch) {
      const sourceName = (duplicateMatch[1] || "").trim().replace(/^["']|["']$/g, "");
      if (sourceName) {
        const allCombined = combined;
        const srcMatch = allCombined.find((f) => f.name.toLowerCase() === sourceName.toLowerCase())
          || allCombined.find((f) => f.path.toLowerCase() === sourceName.toLowerCase())
          || allCombined.find((f) => f.name.toLowerCase().includes(sourceName.toLowerCase()))
          || allCombined.find((f) => f.path.toLowerCase().endsWith("/" + sourceName.toLowerCase()));
        if (srcMatch) {
          const fromPath = srcMatch.path.replace(/\\/g, "/");
          const baseName = path.basename(fromPath);
          const entries = await fs.readdir(fullPath(base), { withFileTypes: true }).catch(() => []);
          const existingNames = entries.filter((e) => !e.name.startsWith(".")).map((e) => e.name);
          let destName = baseName;
          if (existingNames.some((n) => n.toLowerCase() === baseName.toLowerCase())) {
            const extIdx = baseName.lastIndexOf(".");
            const hasExt = extIdx > 0 && /^[a-zA-Z0-9]+$/.test(baseName.slice(extIdx + 1));
            const [namePart, extPart] = hasExt ? [baseName.slice(0, extIdx), baseName.slice(extIdx)] : [baseName, ""];
            let n = 2;
            while (existingNames.some((n2) => n2.toLowerCase() === `${namePart} (${n})${extPart}`.toLowerCase())) n++;
            destName = `${namePart} (${n})${extPart}`;
          }
          const toPath = base ? `${base}/${destName}` : destName;
          const result = await executeAction("copy", { from: fromPath, to: toPath }, base, apiKey);
          return NextResponse.json(result);
        }
      }
    }

    // "move X here" — move into current folder
    const moveHereMatch = queryLower.match(/^move\s+(.+?)\s+here\s*$/i);
    if (moveHereMatch) {
      const sourceName = (moveHereMatch[1] || "").trim().replace(/^["']|["']$/g, "");
      if (sourceName) {
        const allCombined = combined;
        const srcMatch = allCombined.find((f) => f.name.toLowerCase() === sourceName.toLowerCase())
          || allCombined.find((f) => f.path.toLowerCase() === sourceName.toLowerCase())
          || allCombined.find((f) => f.name.toLowerCase().includes(sourceName.toLowerCase()))
          || allCombined.find((f) => f.path.toLowerCase().endsWith("/" + sourceName.toLowerCase()));
        if (srcMatch) {
          const fromPath = srcMatch.path.replace(/\\/g, "/");
          const baseName = path.basename(fromPath);
          const entries = await fs.readdir(fullPath(base), { withFileTypes: true }).catch(() => []);
          const existingNames = entries.filter((e) => !e.name.startsWith(".")).map((e) => e.name);
          let destName = baseName;
          if (existingNames.some((n) => n.toLowerCase() === baseName.toLowerCase())) {
            const extIdx = baseName.lastIndexOf(".");
            const hasExt = extIdx > 0 && /^[a-zA-Z0-9]+$/.test(baseName.slice(extIdx + 1));
            const [namePart, extPart] = hasExt ? [baseName.slice(0, extIdx), baseName.slice(extIdx)] : [baseName, ""];
            let n = 2;
            while (existingNames.some((n2) => n2.toLowerCase() === `${namePart} (${n})${extPart}`.toLowerCase())) n++;
            destName = `${namePart} (${n})${extPart}`;
          }
          const toPath = base ? `${base}/${destName}` : destName;
          const result = await executeAction("move", { from: fromPath, to: toPath }, base, apiKey);
          return NextResponse.json(result);
        }
      }
    }

    // "copy X to Y" / "copy X into Y" — copy file/folder to destination (quick match)
    const copyToMatch = queryLower.match(/copy\s+(.+?)\s+(?:to|into)\s+(.+)$/i);
    if (copyToMatch) {
      const sourceName = (copyToMatch[1] || "").trim().replace(/^["']|["']$/g, "");
      const destName = (copyToMatch[2] || "").trim().replace(/^["']|["']$/g, "");
      if (sourceName && destName) {
        const allCombined = combined;
        const srcMatch = allCombined.find((f) => f.name.toLowerCase() === sourceName.toLowerCase())
          || allCombined.find((f) => f.path.toLowerCase() === sourceName.toLowerCase())
          || allCombined.find((f) => f.name.toLowerCase().includes(sourceName.toLowerCase()))
          || allCombined.find((f) => f.path.toLowerCase().endsWith("/" + sourceName.toLowerCase()));
        const destDir = allCombined.find((f) => f.type === "directory" && f.name.toLowerCase() === destName.toLowerCase())
          || allCombined.find((f) => f.type === "directory" && f.path.toLowerCase().endsWith("/" + destName.toLowerCase()))
          || allCombined.find((f) => f.type === "directory" && f.name.toLowerCase().includes(destName.toLowerCase()));
        if (srcMatch && destDir) {
          const fromPath = srcMatch.path.replace(/\\/g, "/");
          const destPath = destDir.path.replace(/\\/g, "/");
          const toPath = destPath ? `${destPath}/${path.basename(fromPath)}` : path.basename(fromPath);
          const result = await executeAction("copy", { from: fromPath, to: toPath }, base, apiKey);
          return NextResponse.json(result);
        }
      }
    }

    // "move X to Y" / "move X into Y" — move file/folder to destination (quick match, excludes "new workspace")
    const moveToMatch = queryLower.match(/move\s+(.+?)\s+(?:to|into)\s+(?!new\s+workspace)(.+)$/i);
    if (moveToMatch) {
      const sourceName = (moveToMatch[1] || "").trim().replace(/^["']|["']$/g, "");
      const destName = (moveToMatch[2] || "").trim().replace(/^["']|["']$/g, "");
      if (sourceName && destName) {
        const allCombined = combined;
        const srcMatch = allCombined.find((f) => f.name.toLowerCase() === sourceName.toLowerCase())
          || allCombined.find((f) => f.path.toLowerCase() === sourceName.toLowerCase())
          || allCombined.find((f) => f.name.toLowerCase().includes(sourceName.toLowerCase()))
          || allCombined.find((f) => f.path.toLowerCase().endsWith("/" + sourceName.toLowerCase()));
        const destDir = allCombined.find((f) => f.type === "directory" && f.name.toLowerCase() === destName.toLowerCase())
          || allCombined.find((f) => f.type === "directory" && f.path.toLowerCase().endsWith("/" + destName.toLowerCase()))
          || allCombined.find((f) => f.type === "directory" && f.name.toLowerCase().includes(destName.toLowerCase()));
        if (srcMatch && destDir) {
          const fromPath = srcMatch.path.replace(/\\/g, "/");
          const destPath = destDir.path.replace(/\\/g, "/");
          const toPath = destPath ? `${destPath}/${path.basename(fromPath)}` : path.basename(fromPath);
          const result = await executeAction("move", { from: fromPath, to: toPath }, base, apiKey);
          return NextResponse.json(result);
        }
      }
    }

    // "move X to new workspace" (no name) — intelligently use source name as workspace name
    const moveToNewWorkspaceNoNameMatch = queryLower.match(/move\s+(.+?)\s+(?:to|into)\s+(?:a\s+)?new\s+workspace\s*$/i);
    if (moveToNewWorkspaceNoNameMatch) {
      const sourceName = (moveToNewWorkspaceNoNameMatch[1] || "").trim().replace(/^["']|["']$/g, "");
      if (sourceName) {
        const allCombined = combined;
        const match = allCombined.find((f) => f.name.toLowerCase() === sourceName.toLowerCase())
          || allCombined.find((f) => f.path.toLowerCase() === sourceName.toLowerCase())
          || allCombined.find((f) => f.name.toLowerCase().includes(sourceName.toLowerCase()))
          || allCombined.find((f) => f.path.toLowerCase().endsWith("/" + sourceName.toLowerCase()));
        if (match) {
          const fromPath = match.path.replace(/\\/g, "/");
          let workspaceName = match.name.charAt(0).toUpperCase() + match.name.slice(1).toLowerCase();
          // Avoid moving a folder into itself on case-insensitive FS (e.g. macOS): "tyagi" -> "Tyagi" is same path
          if (workspaceName.toLowerCase() === match.name.toLowerCase()) {
            workspaceName = `${workspaceName} Workspace`;
          }
          const toPath = workspaceName + "/" + path.basename(fromPath);
          const workspaceDir = path.join(WORKSPACE, workspaceName);
          const srcFull = fullPath(fromPath);
          const destFull = fullPath(toPath);
          if (!srcFull.startsWith(WORKSPACE) || !destFull.startsWith(WORKSPACE)) {
            return NextResponse.json({ error: "Access denied" }, { status: 403 });
          }
          try {
            await fs.mkdir(workspaceDir, { recursive: false });
          } catch (e) {
            if (e.code !== "EEXIST") {
              return NextResponse.json({ error: e.message }, { status: 500 });
            }
          }
          const data = await readMeta().catch(() => ({}));
          const userWorkspaces = data.userWorkspaces || [];
          if (!userWorkspaces.includes(workspaceName)) {
            userWorkspaces.push(workspaceName);
            await writeMeta({ ...data, userWorkspaces });
          }
          await fs.mkdir(path.dirname(destFull), { recursive: true });
          await fs.rename(srcFull, destFull);
          return NextResponse.json({
            success: true,
            action: "multi_step",
            steps: [
              { success: true, action: "create_folder", path: workspaceName, message: `Created workspace "${workspaceName}" (derived from source)` },
              { success: true, action: "move", from: fromPath, to: toPath, message: `Moved "${match.name}" to workspace "${workspaceName}"` },
            ],
            count: 2,
            message: `Created workspace "${workspaceName}" and moved "${match.name}" into it.`,
          });
        }
      }
    }

    // "move X to new workspace Y" / "move X into new workspace Y" — create workspace with explicit name
    const moveToNewWorkspaceMatch = queryLower.match(/move\s+(.+?)\s+(?:to|into)\s+new\s+workspace\s+(.+)$/i);
    if (moveToNewWorkspaceMatch) {
      const sourceName = (moveToNewWorkspaceMatch[1] || "").trim().replace(/^["']|["']$/g, "");
      let workspaceName = (moveToNewWorkspaceMatch[2] || "").trim().replace(/^["']|["']$/g, "");
      if (sourceName && workspaceName && /^[^/\\<>:"|?*]+$/.test(workspaceName) && !isFillerPhrase(workspaceName)) {
        const allCombined = combined;
        const match = allCombined.find((f) => f.name.toLowerCase() === sourceName.toLowerCase())
                  || allCombined.find((f) => f.path.toLowerCase() === sourceName.toLowerCase())
                  || allCombined.find((f) => f.name.toLowerCase().includes(sourceName.toLowerCase()))
                  || allCombined.find((f) => f.path.toLowerCase().endsWith("/" + sourceName.toLowerCase()));
        if (match) {
          const fromPath = match.path.replace(/\\/g, "/");
          const toPath = workspaceName + "/" + path.basename(fromPath);
          const workspaceDir = path.join(WORKSPACE, workspaceName);
          const srcFull = fullPath(fromPath);
          const destFull = fullPath(toPath);
          if (!srcFull.startsWith(WORKSPACE) || !destFull.startsWith(WORKSPACE)) {
            return NextResponse.json({ error: "Access denied" }, { status: 403 });
          }
          try {
            await fs.mkdir(workspaceDir, { recursive: false });
          } catch (e) {
            if (e.code !== "EEXIST") {
              return NextResponse.json({ error: e.message }, { status: 500 });
            }
          }
          const data = await readMeta().catch(() => ({}));
          const userWorkspaces = data.userWorkspaces || [];
          if (!userWorkspaces.includes(workspaceName)) {
            userWorkspaces.push(workspaceName);
            await writeMeta({ ...data, userWorkspaces });
          }
          await fs.mkdir(path.dirname(destFull), { recursive: true });
          await fs.rename(srcFull, destFull);
          return NextResponse.json({
            success: true,
            action: "multi_step",
            steps: [
              { success: true, action: "create_folder", path: workspaceName, message: `Created workspace "${workspaceName}"` },
              { success: true, action: "move", from: fromPath, to: toPath, message: `Moved "${match.name}" to workspace "${workspaceName}"` },
            ],
            count: 2,
            message: `Created workspace "${workspaceName}" and moved "${match.name}" into it.`,
          });
        }
      }
    }

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

    if (!action) {
      const result = await executeAction("list", {}, currentPath, apiKey);
      return NextResponse.json({ ...result, fallback: true, message: "Showing current folder. (AI response was unclear.)" });
    }

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
