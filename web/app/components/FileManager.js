"use client";

import { useState, useEffect, useRef } from "react";
import FileManagerDeleteModal from "./FileManagerDeleteModal";
import ViewDocumentModal, { isViewable } from "./ViewDocumentModal";
import FileManagerSidebar from "./FileManagerSidebar";
import FileInfoPanel from "./FileInfoPanel";

function ContextMenu({ x, y, onClose, items }) {
  if (!x || !y) return null;
  return (
    <div
      className="fixed z-50 bg-white rounded-lg shadow-xl border border-slate-200 py-1 min-w-[180px]"
      style={{ left: `${x}px`, top: `${y}px` }}
      onClick={(e) => e.stopPropagation()}
    >
      {items.map((item, idx) => (
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
      ))}
    </div>
  );
}

function FileItem({ item, onRightClick, onDoubleClick, viewMode, selected, onSelect, onShiftSelect, onShowInfo }) {
  const isImage = /\.(jpg|jpeg|png|gif|bmp|svg)$/i.test(item.name);
  const isFolder = item.type === "directory";

  const handleClick = (e) => {
    if (e.shiftKey) onShiftSelect(item);
    else onSelect(item, e.ctrlKey || e.metaKey);
    onShowInfo && onShowInfo(item);
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
            <svg className="w-16 h-16 text-purple-500" fill="currentColor" viewBox="0 0 20 20">
              <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
            </svg>
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
      </div>
    );
  }

  // List view
  return (
    <div
      className={`group flex items-center gap-3 px-4 py-2 rounded-lg cursor-pointer border ${
        selected ? "bg-purple-50 border-purple-200" : "hover:bg-slate-50 border-transparent hover:border-slate-200"
      }`}
      onClick={handleClick}
      onContextMenu={(e) => {
        e.preventDefault();
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
        <svg className="w-5 h-5 text-purple-500" fill="currentColor" viewBox="0 0 20 20">
          <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
        </svg>
      ) : (
        <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      )}
      <span className="flex-1 text-sm text-slate-700 truncate">{item.name}</span>
      <span className="text-xs text-slate-400">{item.size || "-"}</span>
    </div>
  );
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
  const [showInfoPanel, setShowInfoPanel] = useState(true);
  const lastClickedIndexRef = useRef(-1);
  const fileInputRef = useRef(null);

  useEffect(() => {
    fetchItems();
  }, [currentPath]);

  useEffect(() => {
    const handleClick = () => setContextMenu({ x: null, y: null, item: null });
    window.addEventListener("click", handleClick);
    return () => window.removeEventListener("click", handleClick);
  }, []);

  async function fetchItems() {
    setLoading(true);
    setSelectedPaths(new Set());
    try {
      const res = await fetch(`/api/file-manager/list?path=${encodeURIComponent(currentPath || "")}`);
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
    const idx = items.findIndex((i) => i.path === item.path);
    if (idx === -1) return;
    const start = lastClickedIndexRef.current >= 0 ? Math.min(lastClickedIndexRef.current, idx) : idx;
    const end = lastClickedIndexRef.current >= 0 ? Math.max(lastClickedIndexRef.current, idx) : idx;
    setSelectedPaths((prev) => {
      const next = new Set(prev);
      for (let i = start; i <= end; i++) next.add(items[i].path);
      return next;
    });
  }

  function setSelectionIndex(item) {
    const idx = items.findIndex((i) => i.path === item.path);
    lastClickedIndexRef.current = idx;
  }

  function handleRightClick(e, item) {
    setContextMenu({ x: e.clientX, y: e.clientY, item });
  }

  function handleDoubleClick(item) {
    if (item.type === "directory") {
      clearSearch();
      onNavigate(item.path);
      addRecent(item.path);
    } else if (isViewable(item.name)) {
      setViewFile({ path: item.path, name: item.name });
      addRecent(item.path);
    }
  }

  function addRecent(pathToAdd) {
    fetch("/api/file-manager/meta", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: pathToAdd, recents: true }),
    }).catch(() => {});
  }

  function handleSearchSubmit(e) {
    e.preventDefault();
    const q = searchQuery.trim();
    if (!q) {
      setSearchResults(null);
      return;
    }
    fetch(`/api/file-manager/search?q=${encodeURIComponent(q)}`)
      .then((r) => r.json())
      .then((d) => setSearchResults(d.items || []))
      .catch(() => setSearchResults([]));
  }

  function clearSearch() {
    setSearchQuery("");
    setSearchResults(null);
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

    if (paths.length === 1) {
      try {
        const res = await fetch("/api/file-manager/delete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path: paths[0] }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Delete failed");
        if (data.operation) onOperation(data.operation);
        fetchItems();
      } catch (e) {
        setDeleteModalTargets(targets);
      }
      return;
    }

    try {
      const res = await fetch("/api/file-manager/delete-bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paths }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Delete failed");
      (data.operations || []).forEach((op) => onOperation(op));
      fetchItems();
    } catch (e) {
      setDeleteModalTargets(targets);
    }
  }

  async function handleDelete() {
    if (contextMenu.item) openDeleteModal([contextMenu.item]);
  }

  function handleDeleteSelected() {
    const targets = items.filter((i) => selectedPaths.has(i.path));
    if (targets.length === 0) return;
    openDeleteModal(targets);
  }

  async function handleRename() {
    if (!contextMenu.item) return;
    const item = contextMenu.item;
    const newName = prompt("Enter new name:", item.name);
    if (!newName || newName === item.name) return;
    
    try {
      const res = await fetch("/api/file-manager/rename", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: item.path, newName }),
      });
      const data = await res.json();
      if (data.operation) onOperation(data.operation);
      fetchItems();
    } catch (e) {
      console.error("Rename failed:", e);
    }
    setContextMenu({ x: null, y: null, item: null });
  }

  async function handleDownload() {
    if (!contextMenu.item || contextMenu.item.type === "directory") return;
    try {
      const res = await fetch(`/api/file-manager/download?path=${encodeURIComponent(contextMenu.item.path)}`);
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
      const res = await fetch("/api/file-manager/create-folder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: currentPath || "", name: newFolderName.trim() }),
      });
      const data = await res.json();
      if (data.operation) onOperation(data.operation);
      setNewFolderName("");
      setShowCreateFolder(false);
      fetchItems();
    } catch (e) {
      console.error("Create folder failed:", e);
    }
  }

  async function handleUpload(e) {
    const files = Array.from(e.target.files);
    for (const file of files) {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("path", currentPath || "");
      try {
        const res = await fetch("/api/file-manager/upload", { method: "POST", body: formData });
        const data = await res.json();
        if (data.operation) onOperation(data.operation);
      } catch (err) {
        console.error("Upload failed:", err);
      }
    }
    fetchItems();
    fileInputRef.current.value = "";
  }

  const contextMenuItems = contextMenu.item
    ? [
        { label: "Get Info", icon: "ℹ️", onClick: () => { setInfoPanelItem(contextMenu.item); setShowInfoPanel(true); } },
        ...(contextMenu.item.type === "directory"
          ? [
              { label: "Open", icon: "📂", onClick: () => handleDoubleClick(contextMenu.item) },
              { label: "Rename", icon: "✏️", onClick: handleRename },
            ]
          : [
              ...(isViewable(contextMenu.item.name) ? [{ label: "View", icon: "👁️", onClick: () => setViewFile({ path: contextMenu.item.path, name: contextMenu.item.name }) }] : []),
              { label: "Download", icon: "⬇️", onClick: handleDownload },
              { label: "Rename", icon: "✏️", onClick: handleRename },
            ]),
        { label: "Delete", icon: "🗑️", onClick: handleDelete },
      ]
    : [];

  const pathParts = currentPath ? currentPath.split("/").filter(Boolean) : [];
  const breadcrumbs = [{ name: "Workspace", path: "" }, ...pathParts.map((p, i) => ({ name: p, path: pathParts.slice(0, i + 1).join("/") }))];
  const displayItems = searchResults !== null ? searchResults.map((p) => ({ path: p.path, name: p.name, type: p.type, size: null })) : items;
  const isSearchMode = searchResults !== null;

  return (
    <div className="h-full flex flex-col bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="flex flex-1 min-h-0">
        <FileManagerSidebar
          currentPath={currentPath}
          onNavigate={(p) => { clearSearch(); onNavigate(p); }}
          onSearchClick={(tag) => setSearchQuery(tag)}
        />
        <div className="flex-1 flex flex-col min-w-0">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <form onSubmit={handleSearchSubmit} className="flex-1 max-w-md flex gap-2">
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              </span>
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search in Workspace"
                className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none"
              />
            </div>
            <button type="submit" className="px-3 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200">
              Search
            </button>
            {isSearchMode && (
              <button type="button" onClick={clearSearch} className="px-3 py-2 text-slate-500 hover:text-slate-700 text-sm">
                Clear
              </button>
            )}
          </form>
          {!isSearchMode && (
          <div className="flex items-center gap-2">
          {breadcrumbs.map((crumb, idx) => (
            <button
              key={idx}
              onClick={() => onNavigate(crumb.path)}
              className={`text-sm ${idx === breadcrumbs.length - 1 ? "text-slate-900 font-semibold" : "text-slate-500 hover:text-purple-600"}`}
            >
              {crumb.name}
              {idx < breadcrumbs.length - 1 && <span className="mx-2">/</span>}
            </button>
          ))}
          </div>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setShowInfoPanel((v) => !v)}
            className={`p-2 rounded-lg ${showInfoPanel ? "bg-purple-100 text-purple-600" : "text-slate-400 hover:bg-slate-100"}`}
            title="Toggle info panel"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </button>
          {selectedPaths.size > 0 && (
            <button
              onClick={handleDeleteSelected}
              className="px-3 py-1.5 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
            >
              Delete selected ({selectedPaths.size})
            </button>
          )}
          <button
            onClick={() => setShowCreateFolder(true)}
            className="px-3 py-1.5 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            + New Folder
          </button>
          <label className="px-3 py-1.5 text-sm bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors cursor-pointer">
            Upload
            <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleUpload} />
          </label>
          <div className="flex border border-slate-200 rounded-lg overflow-hidden">
            <button
              onClick={() => setViewMode("grid")}
              className={`px-2 py-1 text-xs ${viewMode === "grid" ? "bg-purple-600 text-white" : "bg-white text-slate-600"}`}
            >
              Grid
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`px-2 py-1 text-xs ${viewMode === "list" ? "bg-purple-600 text-white" : "bg-white text-slate-600"}`}
            >
              List
            </button>
          </div>
        </div>
      </div>

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

      {/* File List */}
      <div className="flex-1 overflow-y-auto p-4">
        {isSearchMode && (
          <p className="text-sm text-slate-500 mb-2">Search results for &quot;{searchQuery}&quot;</p>
        )}
        {loading ? (
          <div className="flex items-center justify-center h-64 text-slate-400">Loading...</div>
        ) : displayItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-slate-400">
            <svg className="w-16 h-16 mb-4 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" />
            </svg>
            <p>{isSearchMode ? "No results" : "Empty folder"}</p>
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
                onShowInfo={(it) => setInfoPanelItem(it)}
              />
            ))}
          </div>
        ) : (
          <div className="space-y-1">
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
                onShowInfo={(it) => setInfoPanelItem(it)}
              />
            ))}
          </div>
        )}
      </div>
        </div>
        {showInfoPanel && (
          <FileInfoPanel
            path={infoPanelItem?.path}
            name={infoPanelItem?.name}
            onClose={() => setInfoPanelItem(null)}
            onMetaUpdate={() => {}}
          />
        )}
      </div>
    </div>
  );
}
