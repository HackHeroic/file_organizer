"use client";

import { useState, useEffect, useLayoutEffect } from "react";
import { API_BASE } from "@/app/lib/api";

export default function FileManagerSidebar({
  collapsed,
  onToggleCollapse,
  currentPath,
  onNavigate,
  onSearchClick,
  onRefreshMeta,
  onShowError,
}) {
  const [recents, setRecents] = useState([]);
  const [storage, setStorage] = useState(null);
  const [tags, setTags] = useState([]);
  const [workspaces, setWorkspaces] = useState(["My Files"]);
  const [favorites, setFavorites] = useState([]);
  const [sharedPaths, setSharedPaths] = useState([]);
  const [showNewWorkspace, setShowNewWorkspace] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState("");

  const refreshMeta = () => {
    fetch(`${API_BASE}/api/file-manager/meta`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        setRecents(d.recents || []);
        const meta = d.meta || {};
        const tagSet = new Set();
        const starred = [];
        Object.entries(meta).forEach(([p, m]) => {
          (m.tags || []).forEach((t) => tagSet.add(t));
          if (m.starred) starred.push(p);
        });
        setTags(Array.from(tagSet));
        setFavorites(starred);
        setSharedPaths(Object.keys(d.sharedLinks || {}));
      })
      .catch(() => {});
  };

  const refreshStorage = () => {
    fetch(`${API_BASE}/api/file-manager/storage`, { cache: "no-store" })
      .then((r) => r.json())
      .then(setStorage)
      .catch(() => {});
  };

  const refreshAll = () => {
    refreshMeta();
    refreshStorage();
    refreshWorkspaces();
  };

  const refreshWorkspaces = () => {
    fetch(`${API_BASE}/api/file-manager/workspaces`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setWorkspaces(d.workspaces || ["My Files"]))
      .catch(() => {});
  };

  useEffect(() => {
    refreshMeta();
    refreshWorkspaces();
  }, [currentPath]);

  useLayoutEffect(() => {
    if (onRefreshMeta) onRefreshMeta.current = refreshAll;
  });

  useEffect(() => {
    fetch(`${API_BASE}/api/file-manager/storage`, { cache: "no-store" })
      .then((r) => r.json())
      .then(setStorage)
      .catch(() => {});
  }, [currentPath]);

  const isWorkspaceRoot = (name) => {
    if (name === "My Files") return !currentPath;
    return currentPath === name || (currentPath.startsWith(name + "/"));
  };

  const handleCreateWorkspace = () => {
    const name = newWorkspaceName.trim();
    if (!name) return;
    fetch(`${API_BASE}/api/file-manager/workspaces`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.error) throw new Error(d.error);
        setWorkspaces(d.workspaces || workspaces);
        setNewWorkspaceName("");
        setShowNewWorkspace(false);
        onNavigate(name);
      })
      .catch((e) => (onShowError ? onShowError(e.message) : alert(e.message)));
  };

  if (collapsed) {
    return (
      <aside className="w-14 shrink-0 flex flex-col items-center py-3 bg-slate-50 border-r border-slate-200 rounded-l-2xl">
        <button
          onClick={onToggleCollapse}
          className="p-2 rounded-lg text-slate-500 hover:bg-slate-200 hover:text-slate-700 mb-2"
          title="Expand sidebar"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
          </svg>
        </button>
        <button
          onClick={() => onNavigate("")}
          className={`p-2.5 rounded-xl transition-colors ${!currentPath ? "bg-purple-100 text-purple-600" : "text-slate-500 hover:bg-slate-200"}`}
          title="My Files"
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
          </svg>
        </button>
        <div className="mt-2 pt-2 border-t border-slate-200 w-8" />
        <button
          onClick={() => recents[0] && onNavigate(recents[0])}
          className="p-2.5 rounded-xl text-slate-500 hover:bg-slate-200"
          title="Recents"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </button>
        {storage && (
          <div className="mt-auto pt-2 border-t border-slate-200 text-center">
            <span className="text-[10px] text-slate-500 block" title={`${storage.used} of ${storage.max || "?"}`}>
              {storage.used.split(" ")[0]}
              {storage.max ? ` / ${storage.max.split(" ")[0]}` : ""}
            </span>
          </div>
        )}
      </aside>
    );
  }

  return (
    <aside className="w-56 shrink-0 flex flex-col bg-slate-50 border-r border-slate-200 rounded-l-2xl overflow-hidden">
      <div className="flex items-center justify-between px-3 py-3 border-b border-slate-200">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">Navigation</h2>
        <button
          onClick={onToggleCollapse}
          className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-200 hover:text-slate-600"
          title="Collapse sidebar"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7M18 19l-7-7 7-7" />
          </svg>
        </button>
      </div>
      <nav className="flex-1 overflow-y-auto py-3 px-2 scrollbar-thin">
        {/* Workspaces */}
        <div className="px-3 py-1">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Workspaces</span>
        </div>
        {workspaces.map((name) => (
          <button
            key={name}
            onClick={() => onNavigate(name === "My Files" ? "" : name)}
            className={`w-full flex items-center gap-3 px-3 py-2 text-left text-sm rounded-xl transition-colors ${
              isWorkspaceRoot(name) ? "bg-purple-100 text-purple-700 font-medium" : "text-slate-700 hover:bg-slate-100"
            }`}
          >
            <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
            </svg>
            <span className="truncate">{name}</span>
          </button>
        ))}
        {showNewWorkspace && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => { setShowNewWorkspace(false); setNewWorkspaceName(""); }}>
            <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-6 max-w-sm w-full mx-4" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center gap-2 mb-4">
                <div className="p-2 rounded-xl bg-teal-100">
                  <svg className="w-5 h-5 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                  </svg>
                </div>
                <h3 className="font-bold text-lg text-slate-800">Create workspace</h3>
              </div>
              <p className="text-sm text-slate-500 mb-4">Workspaces help you organize files into separate project areas.</p>
              <input
                type="text"
                value={newWorkspaceName}
                onChange={(e) => setNewWorkspaceName(e.target.value)}
                placeholder="Enter workspace name"
                className="w-full px-4 py-2.5 text-sm border border-slate-200 rounded-xl mb-4 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
                onKeyDown={(e) => e.key === "Enter" && handleCreateWorkspace()}
                autoFocus
              />
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => { setShowNewWorkspace(false); setNewWorkspaceName(""); }}
                  className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateWorkspace}
                  className="px-4 py-2 text-sm bg-teal-600 text-white rounded-xl hover:bg-teal-700 transition-colors"
                >
                  Create workspace
                </button>
              </div>
            </div>
          </div>
        )}
        {!showNewWorkspace && (
          <button
            onClick={() => setShowNewWorkspace(true)}
            className="w-full flex items-center gap-3 px-3 py-2 text-left text-sm text-slate-500 hover:bg-slate-100 rounded-xl"
          >
            <svg className="w-4 h-4 shrink-0 text-teal-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
            <span>New workspace</span>
          </button>
        )}

        <div className="my-3 border-t border-slate-200" />
        <div className="px-3 py-1">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Recents</span>
        </div>
        {recents.length === 0 ? (
          <p className="px-3 py-2 text-xs text-slate-400">No recent items</p>
        ) : (
          recents.slice(0, 8).map((p) => (
            <button
              key={p}
              onClick={() => onNavigate(p)}
              className="w-full flex items-center gap-2 px-3 py-2 text-left text-xs text-slate-600 hover:bg-slate-100 rounded-lg truncate"
              title={p}
            >
              <span className="truncate">{p.split("/").pop() || "Workspace"}</span>
            </button>
          ))
        )}

        {favorites.length > 0 && (
          <>
            <div className="my-3 border-t border-slate-200" />
            <div className="px-3 py-1">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Favorites</span>
            </div>
            {favorites.slice(0, 8).map((p) => (
              <button
                key={p}
                onClick={() => onNavigate(p)}
                className="w-full flex items-center gap-2 px-3 py-2 text-left text-xs text-slate-600 hover:bg-slate-100 rounded-lg truncate"
                title={p}
              >
                <span className="text-amber-500">★</span>
                <span className="truncate">{p.split("/").pop() || p}</span>
              </button>
            ))}
          </>
        )}

        {sharedPaths.length > 0 && (
          <>
            <div className="my-3 border-t border-slate-200" />
            <div className="px-3 py-1">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Shared with me</span>
            </div>
            {sharedPaths.slice(0, 8).map((p) => (
              <button
                key={p}
                onClick={() => onNavigate(p)}
                className="w-full flex items-center gap-2 px-3 py-2 text-left text-xs text-slate-600 hover:bg-slate-100 rounded-lg truncate"
                title={p}
              >
                <svg className="w-3.5 h-3.5 text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                </svg>
                <span className="truncate">{p.split("/").pop() || p}</span>
              </button>
            ))}
          </>
        )}

        <div className="my-3 border-t border-slate-200" />
        <div className="px-3 py-1">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Tags</span>
        </div>
        {tags.length === 0 ? (
          <p className="px-3 py-2 text-xs text-slate-400">No tags yet</p>
        ) : (
          tags.map((tag) => (
            <button
              key={tag}
              onClick={() => onSearchClick && onSearchClick(tag)}
              className="w-full flex items-center gap-2 px-3 py-2 text-left text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              <span className="w-2 h-2 rounded-full bg-purple-400 shrink-0" />
              {tag}
            </button>
          ))
        )}
      </nav>
      {storage && (
        <div className="p-3 border-t border-slate-200 bg-white/50 rounded-bl-2xl">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Storage</div>
          <div className="text-sm font-medium text-slate-700">
            {storage.used} of {storage.max || "—"} used
          </div>
          {storage.maxBytes > 0 && (
            <div className="mt-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-purple-500 rounded-full transition-all"
                style={{ width: `${Math.min(100, (storage.usedBytes / storage.maxBytes) * 100)}%` }}
              />
            </div>
          )}
          <div className="text-xs text-slate-500 mt-1">{storage.fileCount} items · {storage.location}</div>
        </div>
      )}
    </aside>
  );
}
