"use client";

import { useState, useEffect } from "react";
import { API_BASE } from "@/app/lib/api";

const VIEWABLE_EXT = [
  ".txt", ".md", ".html", ".css", ".js", ".json",
  ".pdf", ".jpg", ".jpeg", ".png", ".gif", ".svg", ".webp", ".bmp",
  ".mp3", ".wav", ".aac", ".ogg",
  ".mp4", ".mkv", ".avi", ".mov"
];

export function isViewable(name) {
  const ext = name.slice(name.lastIndexOf(".")).toLowerCase();
  return VIEWABLE_EXT.includes(ext);
}

export default function ViewDocumentModal({ filePath, fileName, onClose }) {
  const [content, setContent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [mode, setMode] = useState(""); // "image" | "pdf" | "text" | "audio" | "video"

  const ext = fileName ? fileName.slice(fileName.lastIndexOf(".")).toLowerCase() : "";

  useEffect(() => {
    if (!filePath) return;
    setLoading(true);
    setError(null);

    const imageExts = [".jpg", ".jpeg", ".png", ".gif", ".svg", ".webp", ".bmp"];
    const audioExts = [".mp3", ".wav", ".aac", ".ogg"];
    const videoExts = [".mp4", ".mkv", ".avi", ".mov"];

    if (ext === ".md" || ext === ".txt") {
      setMode("text");
      fetch(`${API_BASE}/api/file-manager/view?path=${encodeURIComponent(filePath)}`)
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
      setContent(`${API_BASE}/api/file-manager/view?path=${encodeURIComponent(filePath)}`);
      setLoading(false);
      return;
    }
    if (ext === ".pdf") {
      setMode("pdf");
      setContent(`${API_BASE}/api/file-manager/view?path=${encodeURIComponent(filePath)}`);
      setLoading(false);
      return;
    }
    if (audioExts.includes(ext)) {
      setMode("audio");
      setContent(`${API_BASE}/api/file-manager/view?path=${encodeURIComponent(filePath)}`);
      setLoading(false);
      return;
    }
    if (videoExts.includes(ext)) {
      setMode("video");
      setContent(`${API_BASE}/api/file-manager/view?path=${encodeURIComponent(filePath)}`);
      setLoading(false);
      return;
    }
    // text fallback
    setMode("text");
    fetch(`${API_BASE}/api/file-manager/view?path=${encodeURIComponent(filePath)}`)
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
          {!loading && !error && mode === "audio" && content && (
            <div className="flex flex-col items-center justify-center py-12 gap-6">
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg">
                <svg className="w-12 h-12 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M18 3a1 1 0 00-1.196-.98l-10 2A1 1 0 006 5v9.114A4.369 4.369 0 005 14c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V7.82l8-1.6v5.894A4.37 4.37 0 0015 12c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V3z" />
                </svg>
              </div>
              <p className="text-sm font-medium text-slate-600">{fileName}</p>
              <audio controls className="w-full max-w-md" src={content}>
                Your browser does not support the audio element.
              </audio>
            </div>
          )}
          {!loading && !error && mode === "video" && content && (
            <div className="flex flex-col items-center gap-4">
              <video controls className="w-full max-h-[70vh] rounded-lg shadow-lg bg-black" src={content}>
                Your browser does not support the video element.
              </video>
              <p className="text-xs text-slate-500">{fileName}</p>
            </div>
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
