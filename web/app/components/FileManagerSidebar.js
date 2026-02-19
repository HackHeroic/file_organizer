"use client";

import { useState, useEffect } from "react";

export default function FileManagerSidebar({ currentPath, onNavigate, onSearchClick }) {
  const [recents, setRecents] = useState([]);
  const [storage, setStorage] = useState(null);
  const [tags, setTags] = useState([]);

  useEffect(() => {
    fetch("/api/file-manager/meta")
      .then((r) => r.json())
      .then((d) => {
        setRecents(d.recents || []);
        const meta = d.meta || {};
        const tagSet = new Set();
        Object.values(meta).forEach((m) => (m.tags || []).forEach((t) => tagSet.add(t)));
        setTags(Array.from(tagSet));
      })
      .catch(() => {});
    fetch("/api/file-manager/storage")
      .then((r) => r.json())
      .then(setStorage)
      .catch(() => {});
  }, [currentPath]);

  return (
    <aside className="w-56 shrink-0 flex flex-col bg-slate-50 border-r border-slate-200 rounded-l-2xl overflow-hidden">
      <div className="p-3 border-b border-slate-200">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 px-2 py-1">Navigation</h2>
      </div>
      <nav className="flex-1 overflow-y-auto py-2">
        <button
          onClick={() => onNavigate("")}
          className={`w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors ${
            !currentPath ? "bg-purple-100 text-purple-700 font-medium" : "text-slate-700 hover:bg-slate-100"
          }`}
        >
          <svg className="w-5 h-5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
          </svg>
          <span>Workspace</span>
        </button>

        <div className="my-2 border-t border-slate-200" />
        <div className="px-4 py-1">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Recents</span>
        </div>
        {recents.length === 0 ? (
          <p className="px-4 py-2 text-xs text-slate-400">No recent items</p>
        ) : (
          recents.slice(0, 10).map((p) => (
            <button
              key={p}
              onClick={() => onNavigate(p)}
              className="w-full flex items-center gap-2 px-4 py-1.5 text-left text-xs text-slate-600 hover:bg-slate-100 truncate"
              title={p}
            >
              <span className="truncate">{p.split("/").pop() || "Workspace"}</span>
            </button>
          ))
        )}

        {tags.length > 0 && (
          <>
            <div className="my-2 border-t border-slate-200" />
            <div className="px-4 py-1">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Tags</span>
            </div>
            {tags.map((tag) => (
              <button
                key={tag}
                onClick={() => onSearchClick && onSearchClick(tag)}
                className="w-full flex items-center gap-2 px-4 py-1.5 text-left text-xs text-slate-600 hover:bg-slate-100"
              >
                <span className="w-2 h-2 rounded-full bg-purple-400" />
                {tag}
              </button>
            ))}
          </>
        )}
      </nav>
      {storage && (
        <div className="p-3 border-t border-slate-200 bg-white/50">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Storage</div>
          <div className="text-sm font-medium text-slate-700">{storage.used} used</div>
          <div className="text-xs text-slate-500">{storage.fileCount} items · {storage.location}</div>
        </div>
      )}
    </aside>
  );
}
