"use client";

import { useState } from "react";

function OpRow({ o }) {
  return (
    <div
      className={`flex flex-wrap items-start gap-2 rounded-lg border px-3 py-2 text-sm ${
        o.success ? "border-purple-200 bg-white" : "border-red-200 bg-red-50"
      }`}
    >
      <span className="font-mono text-purple-600">{o.syscall}</span>
      <span className="text-slate-600">{o.description}</span>
      <span className="font-mono text-slate-500 break-all">{o.path}</span>
      {o.path2 && <span className="font-mono text-slate-400">→ {o.path2}</span>}
      {!o.success && o.error && <span className="text-red-600">{o.error}</span>}
    </div>
  );
}

export default function Home() {
  const [operations, setOperations] = useState([]);
  const [output, setOutput] = useState(null);
  const [loading, setLoading] = useState(null);
  const [error, setError] = useState(null);
  const [createDirName, setCreateDirName] = useState("my_folder");
  const [createFileNames, setCreateFileNames] = useState("a.txt\nb.png\nc.mp3\ndoc.pdf");
  const [organizePath, setOrganizePath] = useState("");
  const [backend, setBackend] = useState(null);

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
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="min-h-screen px-4 py-8 sm:px-6 lg:px-8 max-w-6xl mx-auto">
      <header className="mb-10">
        <h1 className="text-3xl font-bold text-slate-900">
          File Organizer
        </h1>
        <p className="mt-1 text-slate-600">
          Run scenarios and see OS operations (system calls) in real time.
        </p>
        {backend && (
          <p className="mt-2 text-sm text-purple-600 font-medium">
            Backend: {backend === "c" ? "C (organizer_cli)" : "Node.js fallback"}
          </p>
        )}
      </header>

      <section className="mb-10">
        <h2 className="text-lg font-semibold text-slate-800 mb-4">Scenarios</h2>
        <div className="grid gap-6 sm:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="font-medium text-slate-900 mb-2">1. Create directory and files</h3>
            <p className="text-sm text-slate-500 mb-4">
              Creates a folder in the workspace and empty files (mirrors <code className="bg-slate-100 px-1 rounded">mkdir</code> + <code className="bg-slate-100 px-1 rounded">open/write/close</code>).
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Directory name</label>
                <input
                  type="text"
                  value={createDirName}
                  onChange={(e) => setCreateDirName(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  placeholder="my_folder"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">File names (one per line)</label>
                <textarea
                  value={createFileNames}
                  onChange={(e) => setCreateFileNames(e.target.value)}
                  rows={4}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono"
                  placeholder="a.txt\nb.png"
                />
              </div>
              <button
                onClick={runCreateDir}
                disabled={loading !== null}
                className="w-full rounded-lg bg-purple-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50"
              >
                {loading === "create-dir" ? "Running…" : "Run create directory + files"}
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="font-medium text-slate-900 mb-2">2. Organize directory</h3>
            <p className="text-sm text-slate-500 mb-4">
              Scans a folder and moves files into Documents, Images, Audio, Videos, Others (<code className="bg-slate-100 px-1 rounded">readdir</code>, <code className="bg-slate-100 px-1 rounded">mkdir</code>, <code className="bg-slate-100 px-1 rounded">rename</code>).
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Path inside workspace (leave empty for workspace root)</label>
                <input
                  type="text"
                  value={organizePath}
                  onChange={(e) => setOrganizePath(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono"
                  placeholder="my_folder"
                />
              </div>
              <button
                onClick={runOrganize}
                disabled={loading !== null}
                className="w-full rounded-lg border-2 border-purple-600 px-4 py-2.5 text-sm font-medium text-purple-600 hover:bg-purple-50 disabled:opacity-50"
              >
                {loading === "organize" ? "Running…" : "Run organize"}
              </button>
            </div>
          </div>
        </div>
      </section>

      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      <section className="mb-10">
        <h2 className="text-lg font-semibold text-slate-800 mb-4">OS operations (system calls)</h2>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          {operations.length === 0 ? (
            <p className="text-slate-500 text-sm">Run a scenario to see operations.</p>
          ) : (
            <ul className="space-y-2">
              {operations.map((o) => (
                <li key={o.id}>
                  <OpRow o={o} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-slate-800 mb-4">Output</h2>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          {!output ? (
            <p className="text-slate-500 text-sm">Output will appear here after a scenario runs.</p>
          ) : output.type === "create-dir" ? (
            <div>
              <p className="text-sm text-slate-600 mb-2">Created directory and {output.result?.created} file(s).</p>
              <p className="font-mono text-sm text-slate-500">{output.result?.dirPath}</p>
            </div>
          ) : output.type === "organize" && output.result ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Object.entries(output.result).map(([folder, files]) => (
                <div key={folder} className="rounded-lg border border-purple-100 bg-purple-50/50 p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-slate-800">📁 {folder}</span>
                    <span className="rounded-full bg-purple-600 px-2 py-0.5 text-xs text-white">{files.length}</span>
                  </div>
                  <ul className="text-sm text-slate-600 space-y-1">
                    {files.length === 0 ? (
                      <li className="italic">(empty)</li>
                    ) : (
                      files.map((f) => (
                        <li key={f}>📄 {f}</li>
                      ))
                    )}
                  </ul>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
