"use client";

import { useState, useEffect, useLayoutEffect, useRef } from "react";
import { API_BASE } from "@/app/lib/api";
import FileManagerDeleteModal from "./FileManagerDeleteModal";
import ViewDocumentModal, { isViewable } from "./ViewDocumentModal";
import FileManagerSidebar from "./FileManagerSidebar";
import FileInfoPanel from "./FileInfoPanel";

const FOLDER_COLORS = [
  { name: 'Purple', hex: '#a855f7' },
  { name: 'Red', hex: '#ef4444' },
  { name: 'Orange', hex: '#f97316' },
  { name: 'Yellow', hex: '#eab308' },
  { name: 'Green', hex: '#22c55e' },
  { name: 'Blue', hex: '#3b82f6' },
  { name: 'Pink', hex: '#ec4899' },
  { name: 'Gray', hex: '#64748b' }
];

function ContextMenu({ x, y, onClose, items }) {
  const [submenuIndex, setSubmenuIndex] = useState(null);
  if (!x || !y) return null;
  return (
    <div
      className="fixed z-50 bg-white rounded-lg shadow-xl border border-slate-200 py-1 min-w-[180px]"
      style={{ left: `${x}px`, top: `${y}px` }}
      onClick={(e) => e.stopPropagation()}
    >
      {items.map((item, idx) => {
        if (item.subItems) {
          return (
            <div
              key={idx}
              className="relative group"
              onMouseEnter={() => setSubmenuIndex(idx)}
              onMouseLeave={() => setSubmenuIndex(null)}
            >
              <div className={`w-full text-left px-4 py-2 text-sm flex items-center justify-between gap-3 cursor-default ${submenuIndex === idx ? "bg-slate-50" : "text-slate-700 hover:bg-slate-50"}`}>
                <div className="flex items-center gap-3">
                  <span>{item.icon}</span>
                  <span>{item.label}</span>
                </div>
                <svg className="w-4 h-4 text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
              {submenuIndex === idx && (
                <div
                  className="absolute left-full top-0 ml-0 py-1 bg-white rounded-lg shadow-xl border border-slate-200 min-w-[160px] z-50"
                  onMouseEnter={() => setSubmenuIndex(idx)}
                  onMouseLeave={() => setSubmenuIndex(null)}
                >
                  {item.subItems.map((sub, subIdx) => (
                    <button
                      key={subIdx}
                      onClick={() => {
                        sub.onClick();
                        onClose();
                      }}
                      className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-3"
                    >
                      {sub.icon}
                      <span>{sub.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        }
        return (
          <button
            key={idx}
            onClick={() => {
              item.onClick();
              onClose();
            }}
            className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-3"
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function FileItem({ item, onRightClick, onDoubleClick, viewMode, selected, onSelect, onShiftSelect, apiBase }) {
  const isImage = /\.(jpg|jpeg|png|gif|bmp|svg|webp)$/i.test(item.name);
  const isFolder = item.type === "directory";
  const thumbUrl = isImage && item.path ? `${apiBase || ""}/api/file-manager/download?path=${encodeURIComponent(item.path)}` : null;

  const handleClick = (e) => {
    if (e.shiftKey) onShiftSelect(item);
    else onSelect(item, e.ctrlKey || e.metaKey);
    // Info panel opens only via right-click → Get Info
  };
  const handleDoubleClickInner = () => onDoubleClick(item);

  if (viewMode === "grid") {
    return (
      <div
        className={`group relative rounded-lg border transition-all cursor-pointer p-4 ${
          selected ? "bg-purple-50 border-purple-400 ring-2 ring-purple-200" : "bg-white border-slate-200 hover:border-purple-300 hover:shadow-md"
        }`}
        onClick={handleClick}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onRightClick(e, item);
        }}
        onDoubleClick={(e) => { e.stopPropagation(); handleDoubleClickInner(); }}
      >
        <div className="absolute top-2 left-2 z-10">
          <input
            type="checkbox"
            checked={selected}
            onChange={() => onSelect(item, true)}
            onClick={(e) => e.stopPropagation()}
            className="rounded border-slate-300 text-purple-600 focus:ring-purple-500"
          />
        </div>
        <div className="flex flex-col items-center justify-center h-32 mb-2">
          {isFolder ? (
            <svg className="w-16 h-16" style={{ color: item.color || "#a855f7" }} fill="currentColor" viewBox="0 0 20 20">
              <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
            </svg>
          ) : isImage && thumbUrl ? (
            <div className="w-16 h-16 rounded overflow-hidden bg-slate-100 flex items-center justify-center shrink-0 relative">
              <img src={thumbUrl} alt="" className="w-full h-full object-cover" onError={(e) => { e.target.style.display = "none"; e.target.nextElementSibling?.classList.remove("invisible"); }} />
              <span className="absolute inset-0 flex items-center justify-center text-slate-400 text-2xl invisible" aria-hidden>🖼️</span>
            </div>
          ) : isImage ? (
            <div className="w-16 h-16 bg-slate-100 rounded flex items-center justify-center text-xs text-slate-400">
              🖼️
            </div>
          ) : (
            <svg className="w-16 h-16 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          )}
        </div>
        <div className="text-xs text-slate-700 text-center truncate w-full" title={item.name}>
          {item.name}
        </div>
        {item.size != null && (
          <div className="text-[10px] text-slate-500 text-center truncate w-full mt-0.5">
            {item.size}
          </div>
        )}
      </div>
    );
  }

  // List view: row with columns Name, Date modified, Size, Kind (same grid so columns align)
  const kindLabel = isFolder ? "Folder" : (item.name && item.name.includes(".") ? item.name.split(".").pop().toUpperCase() : "File");
  const dateStr = item.modified ? new Date(item.modified).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "—";
  return (
    <div
      className={`grid grid-cols-[32px_28px_minmax(0,1fr)_160px_80px_80px] gap-x-4 items-center px-4 py-2 rounded-lg border cursor-pointer ${
        selected ? "bg-purple-50 border-purple-200" : "hover:bg-slate-50 border-transparent hover:border-slate-200"
      }`}
      onClick={handleClick}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onRightClick(e, item);
      }}
      onDoubleClick={(e) => { e.stopPropagation(); handleDoubleClickInner(); }}
    >
      <input
        type="checkbox"
        checked={selected}
        onChange={() => onSelect(item, true)}
        onClick={(e) => e.stopPropagation()}
        className="rounded border-slate-300 text-purple-600 focus:ring-purple-500 shrink-0"
      />
      {isFolder ? (
        <svg className="w-5 h-5 shrink-0" style={{ color: item.color || "#a855f7" }} fill="currentColor" viewBox="0 0 20 20">
          <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
        </svg>
      ) : isImage && thumbUrl ? (
        <div className="w-6 h-6 rounded overflow-hidden bg-slate-100 shrink-0 flex items-center justify-center relative">
          <img src={thumbUrl} alt="" className="w-full h-full object-cover" onError={(e) => { e.target.style.display = "none"; e.target.nextElementSibling?.classList.remove("invisible"); }} />
          <span className="absolute inset-0 flex items-center justify-center text-slate-400 text-xs invisible" aria-hidden>🖼️</span>
        </div>
      ) : (
        <svg className="w-5 h-5 text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      )}
      <span className="text-sm text-slate-700 truncate min-w-0">{item.name}</span>
      <span className="text-xs text-slate-500 truncate">{dateStr}</span>
      <span className="text-xs text-slate-500 truncate">{item.size || "—"}</span>
      <span className="text-xs text-slate-500 truncate">{kindLabel}</span>
    </div>
  );
}

function formatBytes(bytes) {
  if (bytes == null || typeof bytes !== "number") return "";
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
}

export default function FileManager({ currentPath, onNavigate, onOperation }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [contextMenu, setContextMenu] = useState({ x: null, y: null, item: null });
  const [viewMode, setViewMode] = useState("grid");
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [selectedPaths, setSelectedPaths] = useState(new Set());
  const [deleteModalTargets, setDeleteModalTargets] = useState(null);
  const [viewFile, setViewFile] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState(null);
  const [infoPanelItem, setInfoPanelItem] = useState(null);
  const [showInfoPanel, setShowInfoPanel] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(280);
  const [sidebarResizing, setSidebarResizing] = useState(false);
  const [contextItemStarred, setContextItemStarred] = useState(false);
  const [shareToast, setShareToast] = useState(null); // { link } or { error } when shown
  const [deleteErrorToast, setDeleteErrorToast] = useState(null);
  const [aiPanelOpen, setAiPanelOpen] = useState(false);
  const [aiCommand, setAiCommand] = useState("");
  const [aiResult, setAiResult] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [diskLabel, setDiskLabel] = useState("Local Disk");
  const [showAtPicker, setShowAtPicker] = useState(false);

  const [showColorPicker, setShowColorPicker] = useState(false);

  const [atPickerIndex, setAtPickerIndex] = useState(-1);
  const searchResultsFromAiRef = useRef(false);

  const aiInputRef = useRef(null);
  const lastClickedIndexRef = useRef(-1);
  const shareToastTimerRef = useRef(null);
  const fileInputRef = useRef(null);
  const refreshSidebarMetaRef = useRef(() => {});
  const refreshListRef = useRef(() => {});
  const resizeStartXRef = useRef(0);
  const resizeStartWidthRef = useRef(280);

  useEffect(() => {
    fetchItems();
  }, [currentPath]);

  useLayoutEffect(() => {
    refreshListRef.current = fetchItems;
  });

  // Add current folder to recents whenever we navigate (so Recents is populated)
  useEffect(() => {
    if (!currentPath) return;
    fetch(`${API_BASE}/api/file-manager/meta`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: currentPath, recents: true }),
    }).catch(() => {});
  }, [currentPath]);

  // Live search: debounced as you type — skip when AI search results are active
  const searchQueryRef = useRef(searchQuery);
  searchQueryRef.current = searchQuery;
  useEffect(() => {
    if (searchResultsFromAiRef.current) return;
    const q = searchQuery.trim();
    if (!q) {
      setSearchResults(null);
      return;
    }
    const t = setTimeout(() => {
      if (searchQueryRef.current.trim() !== q) return;
      if (searchResultsFromAiRef.current) return;
      fetch(`${API_BASE}/api/file-manager/search?q=${encodeURIComponent(q)}`)
        .then((r) => r.json())
        .then((d) => setSearchResults(d.items || []))
        .catch(() => setSearchResults([]));
    }, 320);
    return () => clearTimeout(t);
  }, [searchQuery]);

  useEffect(() => {
    const handleClick = () => setContextMenu({ x: null, y: null, item: null });
    window.addEventListener("click", handleClick);
    return () => window.removeEventListener("click", handleClick);
  }, []);

  useEffect(() => {
    if (!shareToast && !deleteErrorToast) return;
    const t = shareToast || deleteErrorToast;
    shareToastTimerRef.current = setTimeout(() => {
      setShareToast(null);
      setDeleteErrorToast(null);
    }, 5000);
    return () => {
      if (shareToastTimerRef.current) clearTimeout(shareToastTimerRef.current);
    };
  }, [shareToast, deleteErrorToast]);

  useEffect(() => {
    if (!contextMenu.item?.path) {
      setContextItemStarred(false);
      return;
    }
    fetch(`${API_BASE}/api/file-manager/meta`)
      .then((r) => r.json())
      .then((d) => setContextItemStarred(!!(d.meta || {})[contextMenu.item.path]?.starred))
      .catch(() => setContextItemStarred(false));
  }, [contextMenu.item?.path]);

  useEffect(() => {
    if (!sidebarResizing) return;
    const onMove = (e) => {
      const delta = e.clientX - resizeStartXRef.current;
      setSidebarWidth((w) => Math.min(420, Math.max(200, resizeStartWidthRef.current + delta)));
    };
    const onUp = () => {
      setSidebarResizing(false);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [sidebarResizing]);

  async function fetchItems() {
    setLoading(true);
    setSelectedPaths(new Set());
    try {
      const isBin = currentPath === ".bin";
      const u = isBin 
        ? `${API_BASE}/api/file-manager/bin/list` 
        : `${API_BASE}/api/file-manager/list?path=${encodeURIComponent(currentPath || "")}`;
      const res = await fetch(u);
      const data = await res.json();
      if (data.items) setItems(data.items);
    } catch (e) {
      console.error("Failed to fetch items:", e);
    } finally {
      setLoading(false);
    }
  }

  function toggleSelect(item, addToSelection) {
    setSelectedPaths((prev) => {
      const next = new Set(prev);
      if (addToSelection) {
        if (next.has(item.path)) next.delete(item.path);
        else next.add(item.path);
      } else {
        next.clear();
        next.add(item.path);
      }
      return next;
    });
  }

  function handleShiftSelect(item) {
    const list = searchResults !== null ? searchResults : items;
    const idx = list.findIndex((i) => i.path === item.path);
    if (idx === -1) return;
    const start = lastClickedIndexRef.current >= 0 ? Math.min(lastClickedIndexRef.current, idx) : idx;
    const end = lastClickedIndexRef.current >= 0 ? Math.max(lastClickedIndexRef.current, idx) : idx;
    setSelectedPaths((prev) => {
      const next = new Set(prev);
      for (let i = start; i <= end; i++) next.add(list[i].path);
      return next;
    });
  }

  function setSelectionIndex(item) {
    const list = searchResults !== null ? searchResults : items;
    const idx = list.findIndex((i) => i.path === item.path);
    lastClickedIndexRef.current = idx;
  }

  function handleRightClick(e, item) {
    setContextMenu({ x: e.clientX, y: e.clientY, item });
  }

  function handleBackgroundRightClick(e) {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, item: null });
  }

  function triggerUpload() {
    fileInputRef.current?.click();
  }

  function handleDirectoryChange(newPath) {
    clearSearch(true);
    setAiCommand("");
    setAiResult(null);
    setInfoPanelItem(null);
    setShowInfoPanel(false);
    searchResultsFromAiRef.current = false;
    onNavigate(newPath);
  }

  function handleDoubleClick(item) {
    if (currentPath === ".bin") return; // No double click action in Bin
    if (item.type === "directory") {
      handleDirectoryChange(item.path);
      addRecent(item.path);
    } else if (isViewable(item.name)) {
      setViewFile({ path: item.path, name: item.name });
      addRecent(item.path);
    }
  }

  function addRecent(pathToAdd) {
    fetch(`${API_BASE}/api/file-manager/meta`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: pathToAdd, recents: true }),
    })
      .then(() => refreshSidebarMetaRef.current?.())
      .catch(() => {});
  }

  function clearSearch(skipFetch = false) {
    setSearchQuery("");
    setSearchResults(null);
    searchResultsFromAiRef.current = false;
    setAiResult(null);
    setAiCommand("");
    if (skipFetch !== true) fetchItems();
  }

  function openDeleteModal(targetItems) {
    setDeleteModalTargets(targetItems);
    setContextMenu({ x: null, y: null, item: null });
  }

  async function confirmDelete() {
    if (!deleteModalTargets || deleteModalTargets.length === 0) return;
    const targets = [...deleteModalTargets];
    const paths = targets.map((t) => t.path);
    setDeleteModalTargets(null);

    if (currentPath === ".bin") {
      try {
        const res = await fetch(`${API_BASE}/api/file-manager/bin/permanent-delete`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ uuids: paths }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Delete failed");
        paths.forEach(p => onOperation && onOperation({ op: "delete", description: "Delete permanently from Bin", success: true, path: p }));
        fetchItems();
      } catch (e) {
        setDeleteModalTargets(targets);
        setDeleteErrorToast(e.message || "Delete failed");
      }
      return;
    }

    if (paths.length === 1) {
      try {
        const res = await fetch(`${API_BASE}/api/file-manager/delete`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path: paths[0] }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Delete failed");
        if (data.operation) onOperation(data.operation);
        fetchItems();
        refreshSidebarMetaRef.current();
      } catch (e) {
        setDeleteModalTargets(targets);
        setDeleteErrorToast(e.message || "Delete failed");
      }
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/file-manager/delete-bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paths }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Delete failed");
      (data.operations || []).forEach((op) => onOperation(op));
      fetchItems();
      refreshSidebarMetaRef.current();
    } catch (e) {
      setDeleteModalTargets(targets);
      setDeleteErrorToast(e.message || "Delete failed");
    }
  }

  async function handleDelete() {
    if (contextMenu.item) openDeleteModal([contextMenu.item]);
  }

  function handleDeleteSelected() {
    const list = searchResults !== null ? searchResults : items;
    const targets = list.filter((i) => selectedPaths.has(i.path));
    if (targets.length === 0) return;
    openDeleteModal(targets);
  }

  async function handleRename() {
    if (!contextMenu.item) return;
    const item = contextMenu.item;
    const newName = prompt("Enter new name:", item.name);
    if (!newName || newName === item.name) return;
    
    try {
      const res = await fetch(`${API_BASE}/api/file-manager/rename`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: item.path, newName }),
      });
      const data = await res.json();
      if (data.operation) onOperation(data.operation);
      fetchItems();
      refreshSidebarMetaRef.current();
    } catch (e) {
      console.error("Rename failed:", e);
    }
    setContextMenu({ x: null, y: null, item: null });
  }

  async function handleDownload() {
    if (!contextMenu.item || contextMenu.item.type === "directory") return;
    try {
      const res = await fetch(`${API_BASE}/api/file-manager/download?path=${encodeURIComponent(contextMenu.item.path)}`);
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = contextMenu.item.name;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      console.error("Download failed:", e);
    }
    setContextMenu({ x: null, y: null, item: null });
  }

  async function handleCreateFolder() {
    if (!newFolderName.trim()) return;
    try {
      const res = await fetch(`${API_BASE}/api/file-manager/create-folder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: currentPath || "", name: newFolderName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.suggestedName) {
          const useAlt = window.confirm(`Folder already exists. Create "${data.suggestedName}" instead?`);
          if (useAlt) {
            const res2 = await fetch(`${API_BASE}/api/file-manager/create-folder`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ path: currentPath || "", name: data.suggestedName }),
            });
            const d2 = await res2.json();
            if (!res2.ok) {
              setShareToast({ error: d2.error || "Failed to create folder" });
              return;
            }
            if (d2.operation) onOperation(d2.operation);
            setNewFolderName("");
            setShowCreateFolder(false);
            fetchItems();
            refreshSidebarMetaRef.current();
            return;
          }
        }
        setShareToast({ error: data.error || "Failed to create folder" });
        return;
      }
      if (data.operation) onOperation(data.operation);
      setNewFolderName("");
      setShowCreateFolder(false);
      fetchItems();
      refreshSidebarMetaRef.current();
    } catch (e) {
      console.error("Create folder failed:", e);
      setShareToast({ error: "Failed to create folder" });
    }
  }

  async function handleUpload(e) {
    const files = Array.from(e.target.files);
    for (const file of files) {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("path", currentPath || "");
      try {
        let res = await fetch(`${API_BASE}/api/file-manager/upload`, { method: "POST", body: formData });
        let data = await res.json();
        if (res.status === 409 && data.exists) {
          const replace = window.confirm(`"${data.fileName}" already exists. Replace it?`);
          if (!replace) continue;
          const retryFormData = new FormData();
          retryFormData.append("file", file);
          retryFormData.append("path", currentPath || "");
          retryFormData.append("overwrite", "true");
          res = await fetch(`${API_BASE}/api/file-manager/upload`, { method: "POST", body: retryFormData });
          data = await res.json();
        }
        if (!res.ok) {
          setShareToast({ error: data.error || "Upload failed" });
          continue;
        }
        if (data.operation) onOperation(data.operation);
      } catch (err) {
        console.error("Upload failed:", err);
        setShareToast({ error: "Upload failed" });
      }
    }
    fetchItems();
    fileInputRef.current.value = "";
    refreshSidebarMetaRef.current();
  }

  async function handleToggleStar() {
    if (!contextMenu.item?.path) return;
    const pathToUpdate = contextMenu.item.path;
    const starred = !contextItemStarred;
    try {
      const res = await fetch(`${API_BASE}/api/file-manager/meta`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: pathToUpdate, meta: { starred } }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      refreshSidebarMetaRef.current();
    } catch (e) {
      console.error(e);
      setShareToast({ error: e.message || "Failed to update favorite" });
    }
    setContextMenu({ x: null, y: null, item: null });
  }

  async function handleAiCommand(overrideCmd) {
    const raw = overrideCmd != null && typeof overrideCmd === "string" ? overrideCmd : aiCommand;
    const cmd = String(raw ?? "").trim();
    if (!cmd) return;
    if (typeof overrideCmd === "string") setAiCommand(overrideCmd);

    const cmdLower = cmd.toLowerCase().trim();

    if ((cmdLower === "show info" || cmdLower === "get info") && selectedPaths.size > 0) {
      const list = searchResults !== null ? searchResults : items;
      const selectedItemsList = list.filter((i) => selectedPaths.has(i.path));
      if (selectedItemsList.length > 0) {
        if (selectedItemsList.length === 1) {
          setInfoPanelItem(selectedItemsList[0]);
        } else {
          setInfoPanelItem({ multi: true, items: selectedItemsList });
        }
        setShowInfoPanel(true);
        setAiResult({ action: "info", message: `Showing info for ${selectedItemsList.length} selected item(s)` });
        return;
      }
    }

    setAiLoading(true);
    setAiResult(null);
    setInfoPanelItem(null);
    setShowInfoPanel(false);

    const displayItems = searchResults !== null ? (searchResults || []).map((p) => ({ path: p.path, name: p.name, type: p.type })) : items;
    try {
      const res = await fetch(`${API_BASE}/api/file-manager/ai-command`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: cmd,
          currentPath: currentPath || "",
          items: displayItems.map((i) => ({ path: i.path, name: i.name, type: i.type })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "AI command failed");
      setAiResult(data);

      if (data.action === "semantic_search" || data.action === "search") {
        if (data.items && data.items.length > 0) {
          searchResultsFromAiRef.current = true;
          const seen = new Set();
          const deduped = data.items.filter((r) => {
            const p = (r.path || "").replace(/\\/g, "/");
            if (seen.has(p)) return false;
            seen.add(p);
            return true;
          });
          setSearchResults(deduped);
          setSearchQuery(cmd);
        } else {
          clearSearch();
        }
      } else if (data.action === "navigate" && data.path != null) {
        handleDirectoryChange(data.path);
      } else if (data.action === "multi_step" || ["list", "create_folder", "move", "delete", "copy", "rename", "suggest", "organize", "remove_duplicates"].includes(data.action)) {
        searchResultsFromAiRef.current = false;
        setSearchResults(null);
        setSearchQuery("");
      }

      const mutatingActions = ["multi_step", "list", "create_folder", "move", "delete", "copy", "rename", "suggest", "organize", "remove_duplicates"];
      if (mutatingActions.includes(data.action)) {
        fetchItems();
        refreshSidebarMetaRef.current();
      } else if (data.action === "search" || data.action === "semantic_search") {
        refreshSidebarMetaRef.current();
      }

      if (data.action === "info" && data.path != null) {
        const infoName = data.name || data.path.split("/").filter(Boolean).pop() || data.path;
        setInfoPanelItem({ path: data.path, name: infoName });
        setShowInfoPanel(true);
      } else if (data.action === "directory_size" || data.action === "total_size") {
        setInfoPanelItem(null);
        setShowInfoPanel(false);
      }
      if (["add_favorite", "remove_favorite", "add_tag", "add_comment"].includes(data.action)) {
        refreshSidebarMetaRef.current();
        if (data.action === "add_tag") setTimeout(() => refreshSidebarMetaRef.current?.(), 150);
      }
    } catch (e) {
      setAiResult({ error: e.message });
    } finally {
      setAiLoading(false);
    }
  }

  function insertAtTag(pathOrName) {
    const toInsert = pathOrName?.path || pathOrName?.name || pathOrName || "";
    const input = aiInputRef.current;
    if (input && toInsert) {
      const pos = input.selectionStart ?? aiCommand.length;
      const before = aiCommand.slice(0, pos);
      const after = aiCommand.slice(pos);
      const atMatch = before.match(/@[^\s]*$/);
      const newBefore = atMatch ? before.slice(0, -atMatch[0].length) : before;
      const newVal = newBefore + toInsert + (after.startsWith(" ") ? "" : " ") + after;
      setAiCommand(newVal);
      setShowAtPicker(false);
      setTimeout(() => {
        input.focus();
        const newPos = newBefore.length + toInsert.length;
        input.setSelectionRange(newPos, newPos);
      }, 0);
    }
  }

  async function handleShare() {
    if (!contextMenu.item?.path) return;
    const path = contextMenu.item.path;
    try {
      const res = await fetch(`${API_BASE}/api/file-manager/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      if (data.link) {
        await navigator.clipboard.writeText(data.link);
        setShareToast({ link: data.link });
      }
      refreshSidebarMetaRef.current();
    } catch (e) {
      setShareToast({ error: e.message || "Share failed" });
    }
    setContextMenu({ x: null, y: null, item: null });
  }

  async function handleApplyColor(colorHex) {
    const list = searchResults !== null ? searchResults : items;
    let targets = list.filter((i) => selectedPaths.has(i.path) && i.type === "directory");
    
    if (targets.length === 0) {
      // If no folders are selected, target all folders in the current view
      targets = list.filter((i) => i.type === "directory");
    }
    
    if (targets.length === 0) {
      setShowColorPicker(false);
      return; 
    }
    
    try {
      for (const t of targets) {
        await fetch(`${API_BASE}/api/file-manager/meta`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path: t.path, meta: { color: colorHex } }),
        });
      }
      fetchItems();
      refreshSidebarMetaRef.current();
    } catch (e) {
      setShareToast({ error: e.message || "Failed to set color" });
    }
    setShowColorPicker(false);
  }

  async function handleRestoreSelected() {
    const list = searchResults !== null ? searchResults : items;
    const targets = list.filter((i) => selectedPaths.has(i.path));
    if (targets.length === 0) return;
    
    const uuids = targets.map(t => t.path);
    try {
      const res = await fetch(`${API_BASE}/api/file-manager/bin/restore`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uuids }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      uuids.forEach(uuid => onOperation && onOperation({ op: "restore", description: "Restore item from Bin", success: true, path: uuid }));
      setSelectedPaths(new Set());
      fetchItems();
    } catch (e) {
      setShareToast({ error: e.message || "Restore failed" });
    }
  }

  const isBin = currentPath === ".bin";

  const contextMenuItems = isBin && contextMenu.item
    ? [
        { label: "Restore", icon: "↺", onClick: async () => {
            const uuid = contextMenu.item.path;
            try {
              const res = await fetch(`${API_BASE}/api/file-manager/bin/restore`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ uuids: [uuid] }),
              });
              const data = await res.json();
              if (data.error) throw new Error(data.error);
              onOperation && onOperation({ op: "restore", description: "Restore item from Bin", success: true, path: uuid });
              fetchItems();
            } catch (e) {
              setShareToast({ error: e.message || "Restore failed" });
            }
            setContextMenu({ x: null, y: null, item: null });
        }},
        { label: "Delete Permanently", icon: "🗑️", onClick: handleDelete }
      ]
    : contextMenu.item
      ? [
        { label: "Get Info", icon: "ℹ️", onClick: () => { setInfoPanelItem(contextMenu.item); setShowInfoPanel(true); } },
        { label: contextItemStarred ? "Remove from Favorites" : "Add to Favorites", icon: "★", onClick: handleToggleStar },
        ...(contextMenu.item.type === "directory"
          ? [
              { label: "Open", icon: "📂", onClick: () => handleDoubleClick(contextMenu.item) },
              ...(currentPath === "" && !contextMenu.item.path.includes("/")
                ? [{ label: "Add to Workspaces", icon: "📁", onClick: () => {
                    fetch(`${API_BASE}/api/file-manager/meta`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ userWorkspacesAdd: contextMenu.item.path }),
                    }).then(() => refreshSidebarMetaRef.current?.());
                    setContextMenu({ x: null, y: null, item: null });
                  } }]
                : []),
              { label: "Share", icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>, subItems: [
                { label: "Share", icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>, onClick: handleShare },
                { label: "Copy link", icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>, onClick: handleShare },
              ]},
              { label: "Rename", icon: "✏️", onClick: handleRename },
            ]
          : [
              ...(isViewable(contextMenu.item.name) ? [{ label: "View", icon: "👁️", onClick: () => setViewFile({ path: contextMenu.item.path, name: contextMenu.item.name }) }] : []),
              { label: "Download", icon: "⬇️", onClick: handleDownload },
              { label: "Share", icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>, subItems: [
                { label: "Share", icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>, onClick: handleShare },
                { label: "Copy link", icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>, onClick: handleShare },
              ]},
              { label: "Rename", icon: "✏️", onClick: handleRename },
            ]),
        { label: "Delete", icon: "🗑️", onClick: handleDelete },
      ]
    : isBin
      ? [
          { label: "Refresh", icon: "🔄", onClick: fetchItems },
        ]
      : [
        { label: "New folder", icon: "📁", onClick: () => { setShowCreateFolder(true); } },
        { label: "Upload files", icon: "⬆️", onClick: triggerUpload },
        { label: "Refresh", icon: "🔄", onClick: fetchItems },
      ];

  useEffect(() => {
    fetch(`${API_BASE}/api/file-manager/workspaces`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => d.diskLabel && setDiskLabel(d.diskLabel))
      .catch(() => {});
  }, []);

  const pathParts = currentPath ? currentPath.split("/").filter(Boolean) : [];
  const breadcrumbs = [{ name: diskLabel, path: "" }, ...pathParts.map((p, i) => ({ name: p, path: pathParts.slice(0, i + 1).join("/") }))];
  const rawDisplay = searchResults !== null ? searchResults : items;
  const seenPaths = new Set();
  const displayItems = rawDisplay.filter((p) => {
    const key = (p.path || p.name || "").replace(/\\/g, "/");
    if (seenPaths.has(key)) return false;
    seenPaths.add(key);
    return true;
  }).map((p) => ({ ...p }));
  const isSearchMode = searchResults !== null;

  function handleSidebarResizeStart(e) {
    if (sidebarCollapsed) return;
    e.preventDefault();
    resizeStartXRef.current = e.clientX;
    resizeStartWidthRef.current = sidebarWidth;
    setSidebarResizing(true);
  }

  return (
    <div
      className={`h-full w-full flex flex-col bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden ${sidebarResizing ? "select-none" : ""}`}
      style={{ minHeight: "500px" }}
    >
      <div className="flex flex-1 min-h-0">
        <FileManagerSidebar
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed((c) => !c)}
          currentPath={currentPath}
          onNavigate={(p) => handleDirectoryChange(p)}
          onSearchClick={(tag) => setSearchQuery(tag)}
          onRefreshMeta={refreshSidebarMetaRef}
          onRefreshList={refreshListRef}
          onShowError={(msg) => setShareToast({ error: msg })}
          width={sidebarWidth}
          isResizing={sidebarResizing}
        />
        {!sidebarCollapsed && (
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize sidebar"
            onMouseDown={handleSidebarResizeStart}
            className="w-2 shrink-0 cursor-col-resize hover:bg-purple-100 active:bg-purple-200 transition-colors group flex items-center justify-center"
          >
            <div className="w-1 h-12 rounded-full bg-slate-300 group-hover:bg-purple-400 opacity-40 group-hover:opacity-100 transition-opacity" />
          </div>
        )}
        <div className="flex-1 flex flex-col min-w-0 min-h-0">
      {/* Toolbar - two-row layout to reduce congestion and use space */}
      <div className="border-b border-slate-200">
        <div className="px-6 py-3 flex items-center gap-4">
          <div className="relative flex-1 max-w-xl">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            </span>
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => {
                searchResultsFromAiRef.current = false;
                setSearchQuery(e.target.value);
              }}
              placeholder="Search (type to search)"
              className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none"
            />
          </div>
          {isSearchMode && (
            <button type="button" onClick={clearSearch} className="px-4 py-2 text-slate-500 hover:text-slate-700 text-sm rounded-xl hover:bg-slate-100 whitespace-nowrap">
              Clear search
            </button>
          )}
        </div>
        <div className="px-6 py-3 flex items-center justify-between gap-6 flex-wrap">
          {!isSearchMode && (
            <nav className="flex items-center gap-1 min-w-0" aria-label="Breadcrumb">
              {breadcrumbs.map((crumb, idx) => (
                <button
                  key={idx}
                  onClick={() => handleDirectoryChange(crumb.path)}
                  className={`text-sm py-1 px-2 rounded-lg transition-colors ${idx === breadcrumbs.length - 1 ? "text-slate-900 font-semibold bg-slate-100" : "text-slate-500 hover:text-purple-600 hover:bg-slate-50"}`}
                >
                  {crumb.name}
                  {idx < breadcrumbs.length - 1 && <span className="mx-1 text-slate-300">/</span>}
                </button>
              ))}
            </nav>
          )}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <button
                onClick={() => setShowColorPicker(!showColorPicker)}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl transition-colors text-sm ${showColorPicker ? "bg-slate-100 text-slate-700" : "text-slate-500 hover:bg-slate-100"}`}
                title="Change folder color"
              >
                <div className="w-4 h-4 rounded-full border border-slate-300" style={{ background: "linear-gradient(45deg, #ef4444 0%, #3b82f6 50%, #22c55e 100%)" }} />
              </button>
              {showColorPicker && (
                <div className="absolute right-0 top-full mt-2 z-50 p-2 bg-white rounded-xl shadow-xl border border-slate-200 grid grid-cols-4 gap-2 w-32">
                  {FOLDER_COLORS.map((c) => (
                    <button
                      key={c.name}
                      onClick={() => handleApplyColor(c.hex)}
                      className="w-6 h-6 rounded-full border border-slate-200 hover:scale-110 transition-transform focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-slate-400"
                      style={{ backgroundColor: c.hex }}
                      title={c.name}
                    />
                  ))}
                  <button
                    onClick={() => handleApplyColor(null)}
                    className="col-span-4 mt-1 text-xs text-slate-500 hover:text-slate-700 p-1 rounded hover:bg-slate-50"
                  >
                    Reset
                  </button>
                </div>
              )}
            </div>
            <button
              onClick={() => setAiPanelOpen((v) => !v)}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl transition-colors text-sm ${aiPanelOpen ? "bg-purple-100 text-purple-600" : "text-slate-500 hover:bg-slate-100"}`}
              title="AI command (e.g. list files, create folder Reports)"
            >
              <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
              <span className="hidden sm:inline">AI</span>
            </button>
            {selectedPaths.size > 0 && !isBin && (
              <button
                onClick={handleDeleteSelected}
                className="flex items-center gap-2 px-4 py-2 text-sm bg-red-500 text-white rounded-xl hover:bg-red-600 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                Delete ({selectedPaths.size})
              </button>
            )}
            {selectedPaths.size > 0 && isBin && (
              <>
                <button
                  onClick={handleRestoreSelected}
                  className="flex items-center gap-2 px-4 py-2 text-sm bg-purple-500 text-white rounded-xl hover:bg-purple-600 transition-colors"
                >
                  Restore ({selectedPaths.size})
                </button>
                <button
                  onClick={handleDeleteSelected}
                  className="flex items-center gap-2 px-4 py-2 text-sm bg-red-500 text-white rounded-xl hover:bg-red-600 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  Delete ({selectedPaths.size})
                </button>
              </>
            )}
            {!isBin && (
              <>
                <button
                  onClick={() => setShowCreateFolder(true)}
                  className="px-4 py-2 text-sm bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition-colors"
                >
                  + New Folder
                </button>
                <label className="px-4 py-2 text-sm bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200 transition-colors cursor-pointer">
                  Upload
                  <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleUpload} />
                </label>
              </>
            )}
            <div className="flex border border-slate-200 rounded-xl overflow-hidden">
              <button
                onClick={() => setViewMode("grid")}
                className={`px-3 py-2 text-xs font-medium ${viewMode === "grid" ? "bg-purple-600 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}
              >
                Grid
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`px-3 py-2 text-xs font-medium ${viewMode === "list" ? "bg-purple-600 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}
              >
                List
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* AI Panel - unified natural language */}
      {aiPanelOpen && (
        <div className="px-5 py-3 border-b border-slate-200 bg-slate-50/80">
          <div className="flex flex-wrap gap-2 mb-2">
            <span className="text-xs text-slate-500 self-center">Suggestions:</span>
            {(() => {
              const hasPdf = items.some((i) => /\.pdf$/i.test(i.name));
              const hasImages = items.some((i) => /\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(i.name));
              const hasAudio = items.some((i) => /\.(mp3|wav|m4a|ogg)$/i.test(i.name));
              const isNotEmpty = items.length > 0;
              const chips = [
                "list files",
                ...(isNotEmpty ? ["show info"] : []),
                ...(hasImages ? ["find photos"] : []),
                ...(hasPdf ? ["find PDFs"] : []),
                ...(hasAudio ? ["find audio"] : []),
                ...(items.length < 3 ? ["create folder Documents"] : []),
              ];
              const fallback = ["list files", "create folder Documents", "show info"];
              const toShow = chips.length >= 2 ? chips : fallback;
              return toShow.map((cmd) => (
                <button
                  key={cmd}
                  type="button"
                  onClick={() => handleAiCommand(cmd)}
                  className="px-3 py-1.5 text-xs rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-purple-50 hover:border-purple-200 hover:text-purple-700 transition-colors"
                >
                  {cmd}
                </button>
              ));
            })()}
          </div>
          <div className="flex gap-2 relative">
            <input
              ref={aiInputRef}
              type="text"
              value={aiCommand}
              onChange={(e) => {
                setAiCommand(e.target.value);
                const v = e.target.value;
                const sel = e.target.selectionStart ?? v.length;
                const beforeCursor = v.slice(0, sel);
                if (/@[^\s]*$/.test(beforeCursor)) {
                  setShowAtPicker(true);
                  const list = searchResults ?? items;
                  const m = (v.slice(0, sel) || "").match(/@([^\s]*)$/);
                  const filter = m ? (m[1] || "").toLowerCase() : "";
                  const filtered = (filter ? list.filter((i) => (i.name || i.path || "").toLowerCase().includes(filter)) : list).slice(0, 12);
                  setAtPickerIndex(filtered.length > 0 ? 0 : -1);
                } else setShowAtPicker(false);
              }}
              onKeyDown={(e) => {
                if (showAtPicker) {
                  const list = searchResults ?? items;
                  const match = (aiCommand.slice(0, aiInputRef.current?.selectionStart ?? aiCommand.length) || "").match(/@([^\s]*)$/);
                  const filter = match ? (match[1] || "").toLowerCase() : "";
                  const filtered = (filter ? list.filter((i) => (i.name || i.path || "").toLowerCase().includes(filter)) : list).slice(0, 12);
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setAtPickerIndex((prev) => (filtered.length ? Math.min(prev + 1, filtered.length - 1) : -1));
                    return;
                  }
                  if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setAtPickerIndex((prev) => (filtered.length ? Math.max(prev - 1, 0) : -1));
                    return;
                  }
                  if (e.key === "Enter" && atPickerIndex >= 0 && atPickerIndex < filtered.length) {
                    e.preventDefault();
                    insertAtTag(filtered[atPickerIndex]);
                    return;
                  }
                  if (e.key === "Escape") { setShowAtPicker(false); setAtPickerIndex(-1); return; }
                }
                if (e.key === "Enter") handleAiCommand();
                if (e.key === "Escape") setShowAtPicker(false);
              }}
              placeholder='e.g. "list files", "move madhav2 to new workspace hello", "show info on @file.pdf" — type @ to tag'
              className="flex-1 px-4 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-purple-500 outline-none"
              disabled={aiLoading}
            />
            {showAtPicker && (() => {
              const list = searchResults ?? items;
              const match = (aiCommand.slice(0, aiInputRef.current?.selectionStart ?? aiCommand.length) || "").match(/@([^\s]*)$/);
              const filter = match ? (match[1] || "").toLowerCase() : "";
              const filtered = (filter ? list.filter((i) => (i.name || i.path || "").toLowerCase().includes(filter)) : list).slice(0, 12);
              return filtered.length > 0 ? (
              <div className="absolute left-0 right-14 top-full mt-1 z-50 py-1 bg-white rounded-lg shadow-xl border border-slate-200 max-h-40 overflow-y-auto">
                <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase">Tag file or folder (↑↓ to navigate, Enter to select)</div>
                {filtered.map((i, idx) => (
                  <button
                    key={i.path}
                    type="button"
                    onClick={() => insertAtTag(i)}
                    className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 ${idx === atPickerIndex ? "bg-purple-100 text-purple-700" : "text-slate-700 hover:bg-purple-50"}`}
                  >
                    <span className="text-purple-500">{i.type === "directory" ? "📁" : "📄"}</span>
                    <span className="truncate">{i.path}</span>
                  </button>
                ))}
              </div>
            ) : null;
            })()}
            <button
              onClick={() => handleAiCommand()}
              disabled={aiLoading || !aiCommand.trim()}
              className="px-4 py-2 bg-purple-600 text-white text-sm rounded-xl hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {aiLoading ? "..." : "Run"}
            </button>
          </div>
          {aiResult && (
            <div className={`mt-2 p-3 rounded-lg text-sm ${aiResult.error ? "bg-red-50 text-red-700" : "bg-white border border-slate-200 text-slate-700"}`}>
              {aiResult.error ? (
                <div>
                  <span className="font-medium block mb-1">Command couldn&apos;t run</span>
                  <span>{aiResult.error}</span>
                  {aiResult.error.includes("GOOGLE_API_KEY") && (
                    <p className="mt-2 text-xs text-red-600/90">Add GOOGLE_API_KEY to your .env.local for AI commands.</p>
                  )}
                  {aiResult.error.includes("path") && (
                    <p className="mt-2 text-xs text-red-600/90">Try including a file or folder name, e.g. &quot;show info on file.pdf&quot;</p>
                  )}
                </div>
              ) : (aiResult.action === "search" || aiResult.action === "semantic_search") ? (
                aiResult.items?.length > 0 ? (
                  <div>
                    <span className="font-medium text-emerald-600">Found {aiResult.count} result{aiResult.count !== 1 ? "s" : ""}</span>
                    <p className="mt-1 text-xs text-slate-500">Results shown in the file grid below ↓</p>
                  </div>
                ) : (
                  <div>
                    <p className="text-slate-600">No matches. You&apos;re back in the folder.</p>
                    <p className="text-xs text-slate-500 mt-1">Try simpler terms: &quot;photos&quot;, &quot;PDFs&quot;, or describe what&apos;s in the file.</p>
                  </div>
                )
              ) : aiResult.action === "suggest" && aiResult.suggestions ? (
                <>
                  <span className="font-medium text-purple-600">Suggestions</span>
                  {aiResult.suggestions.duplicates?.length > 0 && (
                    <div className="mt-2">
                      <span className="text-xs font-bold text-amber-700">Possible duplicates:</span>
                      <ul className="mt-0.5 text-xs font-mono">
                        {aiResult.suggestions.duplicates.slice(0, 3).map((grp, i) => (
                          <li key={i}>{Array.isArray(grp) ? grp.join(" ↔ ") : String(grp)}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {aiResult.suggestions.folderSuggestions?.length > 0 && (
                    <div className="mt-2">
                      <span className="text-xs font-bold text-purple-700">Folder ideas:</span>
                      <ul className="mt-0.5 text-xs font-mono">
                        {aiResult.suggestions.folderSuggestions.slice(0, 3).map((s, i) => (
                          <li key={i}><strong>{s.folder}</strong>: {Array.isArray(s.files) ? s.files.join(", ") : ""}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {(!aiResult.suggestions.duplicates?.length && !aiResult.suggestions.folderSuggestions?.length) && (
                    <span className="text-slate-500">No suggestions for this folder</span>
                  )}
                </>
              ) : aiResult.action === "multi_step" && aiResult.steps ? (
                <div>
                  <span className="font-medium text-emerald-600">Done · {aiResult.count || aiResult.steps.length} step(s)</span>
                  <ul className="mt-1 text-xs text-slate-600 font-mono">
                    {aiResult.steps.map((s, i) => (
                      <li key={i}>{s.action}{s.path ? ` → ${s.path}` : ""}{s.from && s.to ? ` ${s.from} → ${s.to}` : ""}</li>
                    ))}
                  </ul>
                </div>
              ) : (aiResult.action === "directory_size" || aiResult.action === "total_size") ? (
                <div>
                  <span className="font-medium text-purple-600">Directory Size</span>
                  <p className="mt-1 text-sm text-slate-700">
                    <span className="font-semibold">{aiResult.path || "Current folder"}</span>: <span className="text-emerald-600 font-bold">{aiResult.size}</span>
                  </p>
                </div>
              ) : aiResult.action === "info" && (aiResult.size != null || aiResult.name) ? (
                <div>
                  <span className="font-medium text-purple-600">File / folder info</span>
                  <p className="mt-1 text-sm text-slate-700">
                    <span className="font-semibold">{aiResult.name || aiResult.path}</span>
                    {aiResult.size != null && (
                      <>: <span className="text-emerald-600 font-bold">{typeof aiResult.size === "number" ? formatBytes(aiResult.size) : aiResult.size}</span></>
                    )}
                  </p>
                </div>
              ) : aiResult.action === "navigate" ? (
                <div>
                  <span className="font-medium text-emerald-600">{aiResult.message || `Navigated to ${aiResult.path || "root"}`}</span>
                </div>
              ) : aiResult.action === "remove_duplicates" ? (
                <div>
                  <span className="font-medium text-emerald-600">{aiResult.message || `Removed ${aiResult.removed || 0} duplicate(s)`}</span>
                  {aiResult.duplicates?.length > 0 && (
                    <ul className="mt-1 text-xs text-slate-600 font-mono">
                      {aiResult.duplicates.slice(0, 3).map((grp, i) => (
                        <li key={i}>Kept: {grp[0]}, removed: {grp.slice(1).join(", ")}</li>
                      ))}
                    </ul>
                  )}
                </div>
              ) : (
                <>
                  <span className="font-medium text-purple-600">{aiResult.action}</span>
                  {aiResult.message && <p className="mt-1 text-xs text-slate-600">{aiResult.message}</p>}
                  {aiResult.count != null && !aiResult.message && ` · ${aiResult.count} items`}
                  {aiResult.items?.length > 0 && (
                    <ul className="mt-1 max-h-24 overflow-y-auto text-xs font-mono">
                      {aiResult.items.slice(0, 10).map((i, idx) => (
                        <li key={idx}>{i.name} ({i.type})</li>
                      ))}
                      {aiResult.items.length > 10 && <li>…and {aiResult.items.length - 10} more</li>}
                    </ul>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* Create Folder Modal */}
      {showCreateFolder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setShowCreateFolder(false)}>
          <div className="bg-white rounded-xl p-6 max-w-sm w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold text-lg mb-4">Create Folder</h3>
            <input
              type="text"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreateFolder()}
              placeholder="Folder name"
              className="w-full px-4 py-2 border border-slate-300 rounded-lg mb-4 focus:ring-2 focus:ring-purple-500 outline-none"
              autoFocus
            />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowCreateFolder(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg">
                Cancel
              </button>
              <button onClick={handleCreateFolder} className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700">
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      <FileManagerDeleteModal
        targets={deleteModalTargets}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteModalTargets(null)}
      />
      <ViewDocumentModal
        filePath={viewFile?.path}
        fileName={viewFile?.name}
        onClose={() => setViewFile(null)}
      />
      <ContextMenu x={contextMenu.x} y={contextMenu.y} items={contextMenuItems} onClose={() => setContextMenu({ x: null, y: null, item: null })} />

      {/* Share toast - Link copied / Manage access */}
      {(shareToast || deleteErrorToast) && (
        <div className={`fixed bottom-6 left-6 z-[70] flex items-center gap-4 px-5 py-3 rounded-xl shadow-xl border ${deleteErrorToast ? "bg-red-600 text-white border-red-700" : "bg-slate-800 text-white border-slate-700"}`}>
          <span className="text-sm font-medium">{deleteErrorToast || (shareToast.error ? shareToast.error : "Link copied")}</span>
          {shareToast.link && (
            <a
              href={shareToast.link}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-purple-300 hover:text-purple-200 underline"
            >
              Manage access
            </a>
          )}
          <button
            onClick={() => { setShareToast(null); setDeleteErrorToast(null); }}
            className="p-1 rounded-full hover:bg-black/20 text-white/90 hover:text-white transition-colors"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* File List - min-h matches parent so size stays consistent when empty or with few items */}
      <div
        className="flex-1 overflow-y-auto p-4 scrollbar-thin min-h-[400px]"
        onContextMenu={handleBackgroundRightClick}
      >
        {isSearchMode && (
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-slate-600 font-medium">
              Search results for &quot;{searchQuery}&quot;
              {searchResults && <span className="text-slate-400 font-normal ml-1">({searchResults.length} result{searchResults.length !== 1 ? "s" : ""})</span>}
            </p>
            <button
              onClick={clearSearch}
              className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-600 text-sm font-medium hover:bg-slate-200 transition-colors flex items-center gap-1.5"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
              Back to folder
            </button>
          </div>
        )}
        {loading ? (
          <div className="flex items-center justify-center min-h-[360px] text-slate-400">Loading...</div>
        ) : displayItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-[360px] text-slate-400">
            <svg className="w-16 h-16 mb-4 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" />
            </svg>
            <p className="mb-3">{isSearchMode ? "No results" : "Empty folder"}</p>
            {isSearchMode && (
              <button
                onClick={clearSearch}
                className="px-4 py-2 rounded-xl bg-purple-100 text-purple-700 text-sm font-medium hover:bg-purple-200 transition-colors flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                Back to folder
              </button>
            )}
          </div>
        ) : viewMode === "grid" ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {displayItems.map((item) => (
              <FileItem
                key={item.path}
                item={item}
                onRightClick={handleRightClick}
                onDoubleClick={(it) => { setSelectionIndex(it); handleDoubleClick(it); }}
                viewMode="grid"
                selected={selectedPaths.has(item.path)}
                onSelect={(it, add) => { setSelectionIndex(it); toggleSelect(it, add); }}
                onShiftSelect={handleShiftSelect}
                apiBase={API_BASE}
              />
            ))}
          </div>
        ) : (
          <div className="space-y-1">
            <div className="grid grid-cols-[32px_28px_minmax(0,1fr)_160px_80px_80px] gap-x-4 items-center px-4 py-2 border-b border-slate-200 text-xs font-semibold uppercase tracking-wider text-slate-500">
              <span className="w-4" aria-hidden />
              <span className="w-5" aria-hidden />
              <span>Name</span>
              <span>Date modified</span>
              <span>Size</span>
              <span>Kind</span>
            </div>
            {displayItems.map((item) => (
              <FileItem
                key={item.path}
                item={item}
                onRightClick={handleRightClick}
                onDoubleClick={(it) => { setSelectionIndex(it); handleDoubleClick(it); }}
                viewMode="list"
                selected={selectedPaths.has(item.path)}
                onSelect={(it, add) => { setSelectionIndex(it); toggleSelect(it, add); }}
                onShiftSelect={handleShiftSelect}
                apiBase={API_BASE}
              />
            ))}
          </div>
        )}
      </div>
        </div>
        {showInfoPanel && infoPanelItem && (
          <FileInfoPanel
            path={infoPanelItem?.multi ? null : infoPanelItem?.path}
            name={infoPanelItem?.multi ? null : infoPanelItem?.name}
            selectedItems={infoPanelItem?.multi ? infoPanelItem.items : null}
            onClose={() => { setInfoPanelItem(null); setShowInfoPanel(false); }}
            onMetaUpdate={() => refreshSidebarMetaRef.current()}
            onShowError={(msg) => setShareToast({ error: msg })}
          />
        )}
      </div>
    </div>
  );
}
