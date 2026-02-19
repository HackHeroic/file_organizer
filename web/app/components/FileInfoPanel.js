"use client";

import { useState, useEffect } from "react";
import { API_BASE } from "@/app/lib/api";

export default function FileInfoPanel({ path, name, onClose, onMetaUpdate, onShowError }) {
  const [stat, setStat] = useState(null);
  const [meta, setMeta] = useState({ tags: [], comments: "", starred: false });
  const [shareLink, setShareLink] = useState(null);
  const [tagInput, setTagInput] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!path) {
      setStat(null);
      setMeta({ tags: [], comments: "", starred: false });
      setShareLink(null);
      return;
    }
    fetch(`${API_BASE}/api/file-manager/stat?path=${encodeURIComponent(path)}`)
      .then((r) => r.json())
      .then(setStat)
      .catch(() => setStat(null));
    fetch(`${API_BASE}/api/file-manager/meta`)
      .then((r) => r.json())
      .then((d) => {
        const m = (d.meta || {})[path] || {};
        setMeta({ tags: m.tags || [], comments: m.comments || "", starred: !!m.starred });
        const links = d.sharedLinks || {};
        const entry = links[path];
        if (entry?.token) {
          const base = typeof window !== "undefined" ? window.location.origin : "";
          setShareLink(`${base}/share/${entry.token}`);
        } else {
          setShareLink(null);
        }
      })
      .catch(() => {});
  }, [path]);

  async function saveMeta() {
    if (!path) return;
    setSaving(true);
    try {
      await fetch(`${API_BASE}/api/file-manager/meta`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path, meta: { tags: meta.tags, comments: meta.comments, starred: meta.starred } }),
      });
      onMetaUpdate && onMetaUpdate();
    } finally {
      setSaving(false);
    }
  }

  async function toggleStar() {
    if (!path) return;
    const starred = !meta.starred;
    setMeta((m) => ({ ...m, starred }));
    try {
      await fetch(`${API_BASE}/api/file-manager/meta`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path, meta: { starred } }),
      });
      onMetaUpdate && onMetaUpdate();
    } catch (e) {
      setMeta((m) => ({ ...m, starred: !starred }));
    }
  }

  async function getShareLink() {
    if (!path) return;
    try {
      const res = await fetch(`${API_BASE}/api/file-manager/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      const link = data.link || (typeof window !== "undefined" ? `${window.location.origin}/share/${data.token}` : "");
      setShareLink(link);
      if (link && navigator.clipboard) await navigator.clipboard.writeText(link);
    } catch (e) {
      onShowError ? onShowError(e.message || "Failed to create link") : alert(e.message || "Failed to create link");
    }
    onMetaUpdate && onMetaUpdate();
  }

  function addTag() {
    const t = tagInput.trim();
    if (!t || meta.tags.includes(t)) return;
    setMeta((m) => ({ ...m, tags: [...m.tags, t] }));
    setTagInput("");
  }

  function removeTag(tag) {
    setMeta((m) => ({ ...m, tags: m.tags.filter((x) => x !== tag) }));
  }

  if (!path) return null;

  return (
    <div className="w-72 shrink-0 flex flex-col bg-white border-l border-slate-200 rounded-r-2xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
        <span className="text-sm font-semibold text-slate-800">Info</span>
        <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 rounded">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin">
        {stat ? (
          <>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-purple-100 flex items-center justify-center">
                {stat.kind === "Folder" ? (
                  <svg className="w-6 h-6 text-purple-600" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
                  </svg>
                ) : (
                  <svg className="w-6 h-6 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                )}
              </div>
              <div className="min-w-0">
                <div className="font-semibold text-slate-800 truncate">{stat.name}</div>
                <div className="text-xs text-slate-500">{stat.modified ? new Date(stat.modified).toLocaleString() : ""}</div>
                {stat.size && <div className="text-xs text-slate-600 font-medium">{stat.size}</div>}
              </div>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Kind</span>
                <span className="text-slate-800">{stat.kind}</span>
              </div>
              {stat.size && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Size</span>
                  <span className="text-slate-800">{stat.size}</span>
                </div>
              )}
              {stat.itemCount != null && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Items</span>
                  <span className="text-slate-800">{stat.itemCount}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-500">Created</span>
                <span className="text-slate-800">{stat.created ? new Date(stat.created).toLocaleString() : "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Modified</span>
                <span className="text-slate-800">{stat.modified ? new Date(stat.modified).toLocaleString() : "—"}</span>
              </div>
              <div className="pt-2">
                <span className="text-slate-500 block mb-1">Where</span>
                <span className="text-slate-800 text-xs font-mono break-all">{stat.where}</span>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-2">Tags</label>
              <div className="flex flex-wrap gap-1 mb-2">
                {meta.tags.map((t) => (
                  <span
                    key={t}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 text-xs"
                  >
                    {t}
                    <button type="button" onClick={() => removeTag(t)} className="hover:text-purple-900">
                      ×
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-1">
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addTag()}
                  placeholder="Add tag..."
                  className="flex-1 px-2 py-1.5 text-sm border border-slate-200 rounded focus:ring-2 focus:ring-purple-500 outline-none"
                />
                <button type="button" onClick={addTag} className="px-2 py-1.5 bg-purple-600 text-white text-sm rounded hover:bg-purple-700">
                  Add
                </button>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-2">Comments</label>
              <textarea
                value={meta.comments}
                onChange={(e) => setMeta((m) => ({ ...m, comments: e.target.value }))}
                rows={3}
                placeholder="Add a comment..."
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none resize-none"
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={toggleStar}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium ${meta.starred ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}
              >
                <span>{meta.starred ? "★" : "☆"}</span>
                {meta.starred ? "Favorited" : "Add to Favorites"}
              </button>
              <button
                type="button"
                onClick={getShareLink}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-slate-100 text-slate-700 hover:bg-slate-200"
              >
                🔗 {shareLink ? "Copy link" : "Get link"}
              </button>
            </div>
            {shareLink && (
              <div className="text-xs">
                <span className="text-slate-500 block mb-1">Public link</span>
                <input type="text" readOnly value={shareLink} className="w-full px-2 py-1.5 border border-slate-200 rounded bg-slate-50 text-slate-600 truncate" />
              </div>
            )}

            <button
              onClick={() => { saveMeta(); }}
              disabled={saving}
              className="w-full py-2 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save info"}
            </button>
          </>
        ) : (
          <p className="text-slate-500 text-sm">Loading…</p>
        )}
      </div>
    </div>
  );
}
