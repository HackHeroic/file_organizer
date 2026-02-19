"use client";

import { useState, useEffect, useCallback } from "react";
import FileExplorer from "./components/FileExplorer";
import FileManager from "./components/FileManager";
import Logo from "./components/Logo";
import SyscallInfo from "./components/SyscallInfo";
import DeleteConfirmModal from "./components/DeleteConfirmModal";


function OpRow({ o, onShowInfo }) {
  const isErr = !o.success;
  return (
    <div
      className={`group flex items-center gap-3 px-4 py-3 border-l-4 text-sm font-mono transition-all hover:bg-slate-50 relative ${isErr ? "border-red-500 bg-red-50/10" : "border-emerald-500"
        }`}
    >
      {/* Info Button Overlay on Hover */}
      <button
        onClick={() => onShowInfo(o.syscall)}
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-white border border-slate-200 shadow-sm text-xs font-sans font-medium px-2 py-1 rounded-md text-purple-600 hover:text-purple-700 z-10 flex items-center gap-1"
      >
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        Explain
      </button>

      <div className={`shrink-0 w-24 text-xs font-bold ${isErr ? "text-red-500" : "text-emerald-600"}`}>
        {o.syscall.split("(")[0]}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="text-slate-800 font-semibold">{o.op}</span>
          <span className="text-slate-500 text-xs">root/workspace/</span>
          <span className="text-purple-700 break-all">{o.path}</span>
          {o.path2 && (
            <>
              <span className="text-slate-400">→</span>
              <span className="text-purple-700 break-all">{o.path2}</span>
            </>
          )}
        </div>
        <div className="text-slate-500 text-xs mt-1">{o.description}</div>
        {isErr && <div className="text-red-600 text-xs mt-1 font-bold">Error: {o.error}</div>}
      </div>
      <div className="text-xs text-slate-300 group-hover:text-slate-400">
        ID: {o.id}
      </div>
    </div>
  );
}

export default function Home() {
  const [operations, setOperations] = useState([]);
  const [output, setOutput] = useState(null);
  const [loading, setLoading] = useState(null);
  const [error, setError] = useState(null);
  const [createDirName, setCreateDirName] = useState("my_folder_2");
  const [createFileNames, setCreateFileNames] = useState("yadav.txt\nb.png\nc.mp3\ndoc.pdf");
  const [organizePath, setOrganizePath] = useState("");
  const [backend, setBackend] = useState(null);
  const [selectedSyscall, setSelectedSyscall] = useState(null); // For modal
  const [deleteTarget, setDeleteTarget] = useState(null); // { path, type }
  const [dirSearch, setDirSearch] = useState("");
  const [logOnlyErrors, setLogOnlyErrors] = useState(false);
  const [activeTab, setActiveTab] = useState("os"); // "os" or "files"
  const [fileManagerPath, setFileManagerPath] = useState("");


  // File Explorer State
  const [fileTree, setFileTree] = useState([]);

  const fetchFileTree = useCallback(async () => {
    try {
      const res = await fetch("/api/scenario/list-workspace");
      const data = await res.json();
      if (data.tree) {
        setFileTree(data.tree);
      }
    } catch (e) {
      console.error("Failed to fetch tree:", e);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchFileTree();
  }, [fetchFileTree]);

  function flattenDirectories(nodes, acc = []) {
    for (const n of nodes || []) {
      if (n.type === "directory") {
        acc.push({ name: n.name, path: n.path });
        if (n.children?.length) flattenDirectories(n.children, acc);
      }
    }
    return acc;
  }

  const allDirs = flattenDirectories(fileTree);
  const filteredDirs = allDirs.filter((d) => {
    if (!dirSearch.trim()) return true;
    const q = dirSearch.toLowerCase();
    return d.name.toLowerCase().includes(q) || d.path.toLowerCase().includes(q);
  });

  const visibleOps = logOnlyErrors ? operations.filter((o) => !o.success) : operations;

  async function performDelete(pathToDelete) {
    try {
      const res = await fetch("/api/scenario/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetPath: pathToDelete })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      setOperations(prev => [data.operation, ...prev]);
      fetchFileTree();
      setDeleteTarget(null);
    } catch (e) {
      setError(e.message);
    }
  }

  function handleDelete(pathToDelete, type, hasChildren) {
    if (type === "directory" && hasChildren) {
      setDeleteTarget({ path: pathToDelete, type });
      return;
    }
    performDelete(pathToDelete);
  }

  async function runCreateDir() {
    setLoading("create-dir");
    setError(null);
    setOperations([]);
    setOutput(null);
    const fileNames = createFileNames.split(/\n/).map((s) => s.trim()).filter(Boolean);
    try {
      const res = await fetch("/api/scenario/create-dir", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dirName: createDirName, fileNames }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Request failed");
      setOperations(data.operations || []);
      setOutput({ type: "create-dir", result: data.result });
      setBackend(data.backend || null);
      fetchFileTree(); // Update tree
    } catch (e) {
      setError(e.message);
      if (e.operations) setOperations(e.operations);
    } finally {
      setLoading(null);
    }
  }

  async function runOrganize() {
    setLoading("organize");
    setError(null);
    setOperations([]);
    setOutput(null);
    try {
      const res = await fetch("/api/scenario/organize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ directoryPath: organizePath || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Request failed");
      setOperations(data.operations || []);
      setOutput({ type: "organize", result: data.result });
      setBackend(data.backend || null);
      fetchFileTree(); // Update tree
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="min-h-screen font-sans pb-24">
      {/* Educational Modal */}
      {selectedSyscall && (
        <SyscallInfo syscall={selectedSyscall} onClose={() => setSelectedSyscall(null)} />
      )}
      <DeleteConfirmModal
        target={deleteTarget}
        onConfirm={() => performDelete(deleteTarget.path)}
        onCancel={() => setDeleteTarget(null)}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        <header className="mb-8 flex items-center justify-between">
          <Logo />
          {backend && (
            <div className="glass-card px-4 py-1.5 rounded-full text-purple-700 text-xs font-semibold tracking-wide uppercase">
              Backend: {backend === "c" ? "C (Syscalls)" : "Node.js (Fallback)"}
            </div>
          )}
        </header>

        {/* Tabs */}
        <div className="mb-8 flex gap-2 border-b border-slate-200">
          <button
            onClick={() => setActiveTab("os")}
            className={`px-6 py-3 font-semibold text-sm transition-colors border-b-2 ${
              activeTab === "os"
                ? "border-purple-600 text-purple-600"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            OS Operations & Logs
          </button>
          <button
            onClick={() => setActiveTab("files")}
            className={`px-6 py-3 font-semibold text-sm transition-colors border-b-2 ${
              activeTab === "files"
                ? "border-purple-600 text-purple-600"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            File Manager
          </button>
        </div>

        {activeTab === "os" ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column: Controls */}
          <div className="lg:col-span-7 space-y-8">

            {/* Scenarios Section */}
            <section>
              <div className="flex items-center gap-3 mb-4">
                <div className="h-8 w-1 bg-purple-600 rounded-full"></div>
                <h2 className="text-xl font-bold text-slate-800">Scenarios</h2>
              </div>

              <div className="grid gap-6 sm:grid-cols-2">
                {/* Scenario 1 */}
                <div className="glass-card rounded-2xl p-6 relative group transition-all hover:-translate-y-1 hover:shadow-lg">
                  <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                    <svg className="w-20 h-20" fill="currentColor" viewBox="0 0 20 20"><path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" /></svg>
                  </div>
                  <h3 className="font-bold text-slate-900 mb-2 text-lg">1. Create & Populate</h3>
                  <p className="text-xs text-slate-500 mb-6 leading-relaxed">
                    Initialize a workspace using standard <code className="bg-purple-50 px-1 py-0.5 rounded text-purple-600 font-mono">mkdir</code> and <code className="bg-purple-50 px-1 py-0.5 rounded text-purple-600 font-mono">write</code> calls.
                  </p>
                  <div className="space-y-4 relative z-10">
                    <div>
                      <input
                        type="text"
                        value={createDirName}
                        onChange={(e) => setCreateDirName(e.target.value)}
                        className="w-full bg-white/50 backdrop-blur-sm rounded-xl border border-slate-200 px-4 py-3 text-sm focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none transition-all shadow-sm"
                        placeholder="Directory Name"
                      />
                    </div>
                    <div>
                      <textarea
                        value={createFileNames}
                        onChange={(e) => setCreateFileNames(e.target.value)}
                        rows={3}
                        className="w-full bg-white/50 backdrop-blur-sm rounded-xl border border-slate-200 px-4 py-3 text-sm font-mono focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none transition-all resize-none shadow-sm"
                        placeholder="Files..."
                      />
                    </div>
                    <button
                      onClick={runCreateDir}
                      disabled={loading !== null}
                      className="w-full rounded-xl bg-slate-900 hover:bg-slate-800 text-white px-4 py-3 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-xl shadow-slate-200"
                    >
                      {loading === "create-dir" ? "Running..." : "Run Scenario"}
                    </button>
                  </div>
                </div>

                {/* Scenario 2 */}
                <div className="glass-card rounded-2xl p-6 relative group transition-all hover:-translate-y-1 hover:shadow-lg">
                  <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                    <svg className="w-20 h-20" fill="currentColor" viewBox="0 0 20 20"><path d="M4 3a2 2 0 100 4h12a2 2 0 100-4H4z" /><path fillRule="evenodd" d="M3 8h14v7a2 2 0 01-2 2H5a2 2 0 01-2-2V8zm5 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" clipRule="evenodd" /></svg>
                  </div>
                  <h3 className="font-bold text-slate-900 mb-2 text-lg">2. Organize Files</h3>
                  <p className="text-xs text-slate-500 mb-6 leading-relaxed">
                    Automatically sort files by extension using <code className="bg-purple-50 px-1 py-0.5 rounded text-purple-600 font-mono">rename</code> syscalls into categorized folders.
                  </p>
                  <div className="space-y-4 relative z-10">
                    <div className="pt-2">
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Target Directory</label>
                      <input
                        value={dirSearch}
                        onChange={(e) => setDirSearch(e.target.value)}
                        className="w-full mb-3 bg-white/50 backdrop-blur-sm rounded-xl border border-slate-200 px-4 py-2 text-sm font-mono focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none transition-all shadow-sm"
                        placeholder="Search folders (name or path)…"
                      />
                      <div className="relative">
                        <select
                          value={organizePath}
                          onChange={(e) => setOrganizePath(e.target.value)}
                          className="w-full bg-white/50 backdrop-blur-sm rounded-xl border border-slate-200 pl-4 pr-10 py-3 text-sm font-mono focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none transition-all shadow-sm appearance-none cursor-pointer"
                        >
                          <option value="">(root)</option>
                          {filteredDirs.map((dir) => (
                            <option key={dir.path} value={dir.path}>{dir.path}</option>
                          ))}
                        </select>
                        <div className="absolute inset-y-0 right-0 flex items-center px-3 pointer-events-none text-slate-400">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                        </div>
                      </div>
                    </div>
                    <div className="h-[74px]"></div> {/* Spacer */}
                    <button
                      onClick={runOrganize}
                      disabled={loading !== null}
                      className="w-full rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white px-4 py-3 text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-xl shadow-purple-200"
                    >
                      {loading === "organize" ? "Running..." : "Run Organize"}
                    </button>
                  </div>
                </div>
              </div>
            </section>

            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50/50 backdrop-blur-sm px-4 py-3 text-sm text-red-800 flex items-center gap-2 animate-pulse">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                {error}
              </div>
            )}

            {/* OS Operations Log */}
            <section>
              <div className="flex items-center gap-3 mb-4">
                <div className="h-8 w-1 bg-slate-800 rounded-full"></div>
                <div>
                  <h2 className="text-xl font-bold text-slate-800">Kernel Log</h2>
                </div>
                <span className="ml-auto text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded-full uppercase tracking-wider">System Calls</span>
              </div>

              <div className="glass-card rounded-2xl overflow-hidden min-h-[300px]">
                <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-slate-100 bg-white/30">
                  <div className="text-xs text-slate-500 font-semibold">
                    {visibleOps.length} event(s){logOnlyErrors ? " (errors only)" : ""}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setLogOnlyErrors((v) => !v)}
                      className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors ${
                        logOnlyErrors
                          ? "bg-red-50 text-red-700 border-red-200 hover:bg-red-100"
                          : "bg-white/60 text-slate-600 border-slate-200 hover:bg-white"
                      }`}
                      title="Toggle error-only view"
                    >
                      {logOnlyErrors ? "Showing errors" : "Show errors only"}
                    </button>
                    <button
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(JSON.stringify(operations, null, 2));
                        } catch {}
                      }}
                      className="text-xs font-semibold px-3 py-1.5 rounded-lg border bg-white/60 text-slate-600 border-slate-200 hover:bg-white transition-colors"
                      title="Copy log as JSON"
                    >
                      Copy JSON
                    </button>
                    <button
                      onClick={() => setOperations([])}
                      className="text-xs font-semibold px-3 py-1.5 rounded-lg border bg-white/60 text-slate-600 border-slate-200 hover:bg-white transition-colors"
                      title="Clear log"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                {operations.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-300 py-24">
                    <svg className="w-12 h-12 mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                    <p className="text-sm font-medium">Ready for system calls...</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100/50 max-h-[500px] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-200">
                    {visibleOps.map((o) => (
                      <OpRow key={o.id} o={o} onShowInfo={setSelectedSyscall} />
                    ))}
                  </div>
                )}
              </div>
            </section>
          </div>

          {/* Right Column: File Explorer & Output */}
          <div className="lg:col-span-5 space-y-8">

            {/* File Explorer */}
            <section className="h-[520px] flex flex-col">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-8 w-1 bg-indigo-500 rounded-full"></div>
                <h2 className="text-xl font-bold text-slate-800">File System</h2>
              </div>

              <div className="flex-1">
                <FileExplorer tree={fileTree} onDelete={handleDelete} onRefresh={fetchFileTree} />
              </div>
            </section>

            {/* Visual Output */}
            <section>
              <div className="flex items-center gap-3 mb-4">
                <div className="h-8 w-1 bg-emerald-500 rounded-full"></div>
                <h2 className="text-xl font-bold text-slate-800">Result Analysis</h2>
              </div>
              <div className="glass-card rounded-2xl p-6">
                {!output ? (
                  <p className="text-slate-400 text-sm italic py-4 text-center">No operation results yet.</p>
                ) : output.type === "create-dir" ? (
                  <div className="text-center py-6">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 mb-4 shadow-inner">
                      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                    </div>
                    <h4 className="font-bold text-lg text-slate-800">Directory Created</h4>
                    <p className="text-sm text-slate-500 mt-2 max-w-xs mx-auto">{output.result?.created} files generated inside <br /><code className="bg-slate-100 px-2 py-0.5 rounded text-xs font-mono mt-1 inline-block text-slate-700">{output.result?.dirPath}</code></p>
                  </div>
                ) : output.type === "organize" && output.result ? (
                  <div className="grid grid-cols-2 gap-3">
                    {Object.entries(output.result).map(([folder, files]) => (
                      <div key={folder} className="p-3 rounded-xl border border-slate-100 bg-white/50 hover:bg-white hover:shadow-md transition-all group cursor-default">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xl grayscale group-hover:grayscale-0 transition-all">
                              {folder === "Images" ? "🖼️" :
                                folder === "Documents" ? "📄" :
                                  folder === "Audio" ? "🎵" :
                                    folder === "Videos" ? "🎥" : "📦"}
                            </span>
                            <span className="font-bold text-slate-700 text-sm group-hover:text-purple-700">{folder}</span>
                          </div>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${files.length > 0 ? "bg-purple-100 text-purple-700 border-purple-200" : "bg-slate-100 text-slate-400 border-slate-200"}`}>
                            {files.length}
                          </span>
                        </div>
                        <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 opacity-80 w-full transform origin-left scale-x-0 transition-transform duration-700 ease-out" style={{ transform: `scaleX(${files.length > 0 ? 1 : 0})` }}></div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            </section>
          </div>
        </div>
        ) : (
          <div className="h-[calc(100vh-280px)] flex flex-wrap">
            <FileManager
              currentPath={fileManagerPath}
              onNavigate={(path) => setFileManagerPath(path)}
              onOperation={(op) => {
                setOperations((prev) => [op, ...prev]);
                fetchFileTree();
              }}
            />
          </div>
        )}
      </div>

      <footer className="mt-16 py-10 text-center text-sm text-slate-500">
        Made with ❤️ by <span className="font-semibold text-slate-700">C Murali Madhav</span>,{" "}
        <span className="font-semibold text-slate-700">Ravi Yadav</span>
      </footer>
    </div>
  );
}
