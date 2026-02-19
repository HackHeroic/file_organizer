"use client";

import { useState, useEffect } from "react";

const VIEWABLE_EXT = [
  ".txt", ".md", ".html", ".css", ".js", ".json",
  ".pdf", ".jpg", ".jpeg", ".png", ".gif", ".svg", ".webp", ".bmp"
];

export function isViewable(name) {
  const ext = name.slice(name.lastIndexOf(".")).toLowerCase();
  return VIEWABLE_EXT.includes(ext);
}

export default function ViewDocumentModal({ filePath, fileName, onClose }) {
  const [content, setContent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [mode, setMode] = useState(""); // "image" | "pdf" | "text"

  const ext = fileName ? fileName.slice(fileName.lastIndexOf(".")).toLowerCase() : "";

  useEffect(() => {
    if (!filePath) return;
    setLoading(true);
    setError(null);

    const imageExts = [".jpg", ".jpeg", ".png", ".gif", ".svg", ".webp", ".bmp"];
    if (ext === ".md" || ext === ".txt") {
      setMode("text");
      fetch(`/api/file-manager/view?path=${encodeURIComponent(filePath)}`)
        .then((r) => {
          if (!r.ok) throw new Error("Failed to load");
          return r.text();
        })
        .then(setContent)
        .catch(setError)
        .finally(() => setLoading(false));
      return;
    }
    if (imageExts.includes(ext)) {
      setMode("image");
      setContent(`/api/file-manager/view?path=${encodeURIComponent(filePath)}`);
      setLoading(false);
      return;
    }
    if (ext === ".pdf") {
      setMode("pdf");
      setContent(`/api/file-manager/view?path=${encodeURIComponent(filePath)}`);
      setLoading(false);
      return;
    }
    // text
    setMode("text");
    fetch(`/api/file-manager/view?path=${encodeURIComponent(filePath)}`)
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load");
        return r.text();
      })
      .then(setContent)
      .catch(setError)
      .finally(() => setLoading(false));
  }, [filePath, ext]);

  if (!filePath) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col border border-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
          <h3 className="font-semibold text-slate-800 truncate">{fileName}</h3>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="flex-1 overflow-auto p-4 min-h-[200px] scrollbar-thin">
          {loading && <p className="text-slate-500">Loading...</p>}
          {error && <p className="text-red-600">{error}</p>}
          {!loading && !error && mode === "image" && content && (
            <img src={content} alt={fileName} className="max-w-full h-auto rounded-lg shadow-inner" />
          )}
          {!loading && !error && mode === "pdf" && content && (
            <embed
              src={content}
              type="application/pdf"
              className="w-full min-h-[70vh] rounded-lg border border-slate-200"
              title={fileName}
            />
          )}
          {!loading && !error && mode === "text" && content != null && (
            <pre className="text-sm text-slate-700 bg-slate-50 p-4 rounded-lg overflow-x-auto whitespace-pre-wrap font-mono">
              {content}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}
