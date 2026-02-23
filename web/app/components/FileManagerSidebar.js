"use client";

import { useState, useEffect, useLayoutEffect, useRef } from "react";
import { API_BASE } from "@/app/lib/api";

const SIDEBAR_WIDTH_MIN = 200;
const SIDEBAR_WIDTH_MAX = 420;
const SIDEBAR_WIDTH_DEFAULT = 280;

export default function FileManagerSidebar({
  collapsed,
  onToggleCollapse,
  currentPath,
  onNavigate,
  onSearchClick,
  onRefreshMeta,
  onRefreshList,
  onShowError,
  width = SIDEBAR_WIDTH_DEFAULT,
  onWidthChange,
  isResizing,
}) {
  const [recents, setRecents] = useState([]);
  const [storage, setStorage] = useState(null);
  const [tags, setTags] = useState([]);
  const [diskLabel, setDiskLabel] = useState("Local Disk");
  const [workspaces, setWorkspaces] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [sharedPaths, setSharedPaths] = useState([]);
  const [showNewWorkspace, setShowNewWorkspace] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState("");
  const [openMenu, setOpenMenu] = useState(null);
  const [renamingFolder, setRenamingFolder] = useState(null);
  const [renameValue, setRenameValue] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const menuRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setOpenMenu(null);
    }
    if (openMenu) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [openMenu]);

  const refreshMeta = () => {
    fetch(`${API_BASE}/api/file-manager/meta?t=${Date.now()}`, { cache: "no-store" })
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

  const STORAGE_CACHE_KEY = "file-manager-storage-cache";

  const refreshStorage = () => {
    fetch(`${API_BASE}/api/file-manager/storage?t=${Date.now()}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          try {
            const cached = localStorage.getItem(STORAGE_CACHE_KEY);
            if (cached) setStorage({ ...JSON.parse(cached), fallback: true });
          } catch {}
          return;
        }
        if (!data.fallback) {
          try {
            localStorage.setItem(STORAGE_CACHE_KEY, JSON.stringify(data));
          } catch {}
        }
        setStorage(data);
      })
      .catch(() => {
        try {
          const cached = localStorage.getItem(STORAGE_CACHE_KEY);
          if (cached) setStorage({ ...JSON.parse(cached), fallback: true });
        } catch {}
      });
  };

  const refreshAll = () => {
    refreshMeta();
    refreshStorage();
    refreshWorkspaces();
  };

  const refreshWorkspaces = () => {
    fetch(`${API_BASE}/api/file-manager/workspaces`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        setDiskLabel(d.diskLabel || "Local Disk");
        setWorkspaces(d.workspaces || []);
      })
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
    fetch(`${API_BASE}/api/file-manager/storage?t=${Date.now()}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          try {
            const cached = localStorage.getItem(STORAGE_CACHE_KEY);
            if (cached) setStorage({ ...JSON.parse(cached), fallback: true });
          } catch {}
          return;
        }
        if (!data.fallback) {
          try {
            localStorage.setItem(STORAGE_CACHE_KEY, JSON.stringify(data));
          } catch {}
        }
        setStorage(data);
      })
      .catch(() => {
        try {
          const cached = localStorage.getItem(STORAGE_CACHE_KEY);
          if (cached) setStorage({ ...JSON.parse(cached), fallback: true });
        } catch {}
      });
  }, [currentPath]);

  const isWorkspaceRoot = (name) => {
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
        setDiskLabel(d.diskLabel || diskLabel);
        setWorkspaces(d.workspaces || []);
        setNewWorkspaceName("");
        setShowNewWorkspace(false);
        onNavigate(name);
      })
      .catch((e) => (onShowError ? onShowError(e.message) : alert(e.message)));
  };

  const handleRenameWorkspace = (oldName, newName) => {
    const n = (newName || "").trim();
    if (!n || n === oldName) {
      setRenamingFolder(null);
      setRenameValue("");
      return;
    }
    fetch(`${API_BASE}/api/file-manager/rename`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: oldName, newName: n }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.error) throw new Error(d.error);
        setOpenMenu(null);
        setRenamingFolder(null);
        setRenameValue("");
        refreshWorkspaces();
        if (isWorkspaceRoot(oldName)) {
          const subpath = currentPath.startsWith(oldName + "/") ? currentPath.slice(oldName.length) : "";
          onNavigate(subpath ? n + "/" + subpath : n);
        }
        if (onRefreshMeta?.current) onRefreshMeta.current();
        if (onRefreshList?.current) onRefreshList.current();
      })
      .catch((e) => (onShowError ? onShowError(e.message) : alert(e.message)));
  };

  const performDeleteWorkspace = (name) => {
    fetch(`${API_BASE}/api/file-manager/delete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: name }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.error) throw new Error(d.error);
        setOpenMenu(null);
        setDeleteTarget(null);
        refreshWorkspaces();
        if (isWorkspaceRoot(name)) onNavigate("");
        if (onRefreshMeta?.current) onRefreshMeta.current();
        if (onRefreshList?.current) onRefreshList.current();
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
          title={diskLabel}
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
    <>
      {deleteTarget && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm" onClick={() => setDeleteTarget(null)}>
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full border border-slate-100" onClick={(e) => e.stopPropagation()}>
            <div className="flex flex-col items-center text-center">
              <div className="w-12 h-12 bg-red-100 text-red-500 rounded-full flex items-center justify-center mb-4">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
              </div>
              <h3 className="text-lg font-bold text-slate-800 mb-2">Delete folder?</h3>
              <p className="text-sm text-slate-500 mb-6">
                <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-700">{deleteTarget}</span> and all its contents will be removed. This cannot be undone.
              </p>
              <div className="flex gap-3 w-full">
                <button
                  onClick={() => setDeleteTarget(null)}
                  className="flex-1 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => performDeleteWorkspace(deleteTarget)}
                  className="flex-1 px-4 py-2 bg-red-500 hover:bg-red-600 text-white text-sm font-medium rounded-xl shadow-lg shadow-red-200 transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    <aside
      className="shrink-0 flex flex-col bg-slate-50 border-r border-slate-200 rounded-l-2xl overflow-hidden transition-[width] duration-150"
      style={{ width: collapsed ? 56 : width }}
    >
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
        {/* Main storage / disk - root */}
        <div className="px-3 py-1">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Storage</span>
        </div>
        <div
          className={`group flex items-center gap-2 px-3 py-2 rounded-xl transition-colors ${
            !currentPath ? "bg-purple-100 text-purple-700" : "text-slate-700 hover:bg-slate-100"
          }`}
        >
          <button
            onClick={() => onNavigate("")}
            className={`flex-1 flex items-center gap-3 min-w-0 text-left text-sm ${!currentPath ? "font-medium" : ""}`}
          >
            <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
            </svg>
            <span className="truncate">{diskLabel}</span>
          </button>
        </div>

        {/* Workspaces - only folders created via "New workspace" */}
        {workspaces.length > 0 && (
          <>
            <div className="px-3 py-1 mt-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Workspaces</span>
            </div>
            {workspaces.map((name) => {
              const isRenaming = renamingFolder === name;
              return (
                <div
                  key={name}
                  className={`group flex items-center gap-2 pl-6 pr-3 py-2 rounded-xl transition-colors ${
                    isWorkspaceRoot(name) ? "bg-purple-100 text-purple-700" : "text-slate-700 hover:bg-slate-100"
                  }`}
                  style={{ marginLeft: "0.25rem" }}
                >
              <button
                onClick={() => onNavigate(name)}
                className={`flex-1 flex items-center gap-3 min-w-0 text-left text-sm ${isWorkspaceRoot(name) ? "font-medium" : ""}`}
              >
                <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
                </svg>
                {isRenaming ? (
                  <input
                    type="text"
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleRenameWorkspace(name, renameValue);
                      if (e.key === "Escape") { setRenamingFolder(null); setRenameValue(""); }
                    }}
                    onBlur={() => handleRenameWorkspace(name, renameValue)}
                    className="flex-1 min-w-0 px-1 py-0.5 text-sm bg-white border border-purple-300 rounded focus:ring-2 focus:ring-purple-500 focus:outline-none"
                    autoFocus
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <span className="truncate">{name}</span>
                )}
              </button>
              {(
                <div className="relative shrink-0" ref={openMenu === name ? menuRef : undefined}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpenMenu(openMenu === name ? null : name);
                    }}
                    className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-200 opacity-70 hover:opacity-100 transition-opacity"
                    title="More options"
                    aria-label="Folder options"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                    </svg>
                  </button>
                  {openMenu === name && (
                    <div className="absolute right-0 top-full mt-1 z-50 py-1.5 bg-white rounded-xl shadow-xl border border-slate-200 min-w-[160px] whitespace-nowrap">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenMenu(null);
                          setRenamingFolder(name);
                          setRenameValue(name);
                        }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                      >
                        <svg className="w-4 h-4 shrink-0 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        <span>Rename</span>
                      </button>
                      <div className="my-1 border-t border-slate-100" />
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenMenu(null);
                          setDeleteTarget(name);
                        }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm text-red-600 hover:bg-red-50 transition-colors"
                      >
                        <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        <span>Delete</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
          </>
        )}
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
              onClick={() => {
                fetch(`${API_BASE}/api/file-manager/stat?path=${encodeURIComponent(p)}`)
                  .then((r) => r.json())
                  .then((s) => {
                    if (s.error && s.error.includes("Not a directory")) {
                      const parts = p.split("/");
                      parts.pop();
                      onNavigate(parts.join("/"));
                    } else if (s.kind === "Folder" || s.kind === "directory") {
                      onNavigate(p);
                    } else {
                      const parts = p.split("/");
                      parts.pop();
                      onNavigate(parts.join("/"));
                    }
                  })
                  .catch(() => onNavigate(p));
              }}
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
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Storage {storage.fallback && "(cached)"}</div>
          <div className="text-sm font-medium text-slate-700">
            {storage.used} of {storage.max || "—"} used
          </div>
          {storage.maxBytes > 0 && !storage.fallback && (
            <div className="mt-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-purple-500 rounded-full transition-all"
                style={{ width: `${Math.min(100, ((storage.usedBytes || 0) / storage.maxBytes) * 100)}%` }}
              />
            </div>
          )}
          {storage.fallback && (
            <p className="text-[10px] text-amber-600 mt-1">Storage unavailable on this host; showing last known.</p>
          )}
          <div className="text-xs text-slate-500 mt-1">{storage.fileCount} items · {storage.location}</div>
        </div>
      )}
    </aside>
    </>
  );
}
