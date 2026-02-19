import { NextResponse } from "next/server";
import { executeAction, fullPath } from "../lib/execute-action";
import path from "path";

const WORKSPACE = process.env.WORKSPACE_PATH || path.join(process.cwd(), "workspace");
const GEMINI_API = "https://generativelanguage.googleapis.com/v1beta/models";

const DESTRUCTIVE_ACTIONS = new Set(["delete", "move"]);

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
        temperature: 0.2,
      },
    }),
  });
  if (!res.ok) {
    if (!useFallback && (res.status === 404 || res.status === 400)) return callGemini(prompt, apiKey, true);
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
    const body = await request.json();
    const { goal, currentPath, execute, steps: requestedSteps } = body;

    if (execute && Array.isArray(requestedSteps) && requestedSteps.length > 0) {
      const base = currentPath || "";
      const results = [];
      for (const step of requestedSteps) {
        const { action, params } = step;
        if (!["list", "create_folder", "move", "delete"].includes(action)) continue;
        try {
          const r = await executeAction(action, params || {}, base);
          results.push({ ...r, step });
        } catch (e) {
          results.push({ error: e.message, step });
        }
      }
      return NextResponse.json({ success: true, action: "execute", results });
    }

    if (!goal || typeof goal !== "string") {
      return NextResponse.json({ error: "goal required" }, { status: 400 });
    }

    const base = currentPath || "";
    const dirPath = fullPath(base);
    if (!dirPath.startsWith(WORKSPACE)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const { readdir, stat } = await import("fs/promises");
    const entries = await readdir(dirPath, { withFileTypes: true }).catch(() => []);
    const fileList = [];
    for (const ent of entries) {
      if (ent.name.startsWith(".")) continue;
      const rel = path.join(base, ent.name).replace(/\\/g, "/");
      const fp = path.join(dirPath, ent.name);
      const s = await stat(fp).catch(() => null);
      fileList.push({
        path: rel,
        name: ent.name,
        type: ent.isDirectory() ? "directory" : "file",
        size: s?.isFile() ? s.size : null,
      });
    }

    const listStr = fileList.map((f) => `- ${f.path} (${f.type}${f.size != null ? `, ${f.size}B` : ""})`).join("\n");
    const prompt = `You are an autonomous file organizer agent. The user's goal: "${goal}"
Current folder: "${base || "(root)"}"
Files in this folder:
${listStr || "(empty)"}

Create a step-by-step plan to achieve the goal. Use ONLY these actions:
- list (no params) - list current folder (usually first step)
- create_folder - {"name": "FolderName"}
- move - {"from": "source_path", "to": "dest_path"} (dest can be folder or folder/filename)
- delete - {"path": "path_to_delete"}

Rules:
- Paths are relative to workspace root. Use the exact paths from the list.
- For "organize" goals: create folders first, then move files into them.
- For "clean up" goals: suggest moving duplicates or unused files.
- Require user confirmation for move and delete (destructive).
- Return 1-10 steps. Be specific with paths.

Respond with JSON only: {"steps": [{"action": "create_folder", "params": {"name": "X"}, "requiresConfirm": false}, {"action": "move", "params": {"from": "a.pdf", "to": "Documents/a.pdf"}, "requiresConfirm": true}, ...], "summary": "Brief description of the plan"}`;

    const parsed = await callGemini(prompt, apiKey);
    const steps = Array.isArray(parsed?.steps) ? parsed.steps : [];
    const summary = typeof parsed?.summary === "string" ? parsed.summary : "";
    const normalized = steps.map((s) => ({
      action: (s.action || "").toLowerCase(),
      params: s.params || {},
      requiresConfirm: DESTRUCTIVE_ACTIONS.has((s.action || "").toLowerCase()) ? true : !!s.requiresConfirm,
    }));

    return NextResponse.json({
      success: true,
      action: "plan",
      steps: normalized,
      summary,
      itemCount: fileList.length,
    });
  } catch (e) {
    console.error("AI agent error:", e);
    return NextResponse.json({ error: e.message || "Agent failed" }, { status: 500 });
  }
}
