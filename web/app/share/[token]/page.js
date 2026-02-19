"use client";

import { useParams } from "next/navigation";
import { useState, useEffect } from "react";
import Link from "next/link";
import ViewDocumentModal, { isViewable } from "@/app/components/ViewDocumentModal";

export default function SharedPage() {
  const params = useParams();
  const token = params.token;
  const [path, setPath] = useState(null);
  const [isFile, setIsFile] = useState(false);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [viewFile, setViewFile] = useState(null);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      try {
        const shareRes = await fetch(`/api/file-manager/share?token=${encodeURIComponent(token)}`);
        const shareData = await shareRes.json();
        if (shareData.error) throw new Error(shareData.error);
        if (cancelled) return;
        setPath(shareData.path);
        const file = shareData.isFile ?? false;
        setIsFile(file);
        if (file) {
          const name = shareData.path.split("/").pop() || "Shared file";
          setItems([{ path: shareData.path, name, type: "file" }]);
        } else {
          const listRes = await fetch(`/api/file-manager/list?path=${encodeURIComponent(shareData.path)}`);
          const listData = await listRes.json();
          if (!cancelled && listData.items) setItems(listData.items);
        }
      } catch (e) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="text-slate-500">Loading…</div>
      </div>
    );
  }
  if (error || !path) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow p-8 max-w-md text-center">
          <p className="text-red-600 font-medium mb-4">{error || "Link not found or expired."}</p>
          <Link href="/" className="text-purple-600 hover:underline">Back to File Manager</Link>
        </div>
      </div>
    );
  }

  const name = path.split("/").pop() || (isFile ? "Shared file" : "Shared folder");
  return (
    <div className="min-h-screen bg-slate-100 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <Link href="/" className="text-purple-600 hover:underline text-sm">← Back to File Manager</Link>
          <h1 className="text-xl font-semibold text-slate-800">Shared: {name}</h1>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200 text-sm text-slate-500">
            View-only. Path: <span className="font-mono text-slate-700">{path}</span>
          </div>
          <div className="p-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
            {items.length === 0 ? (
              <p className="col-span-full text-slate-400 text-sm">This folder is empty.</p>
            ) : (
              items.map((item) => {
                const canView = item.type === "file" && isViewable(item.name);
                const handleClick = () => {
                  if (item.type === "directory") return;
                  if (canView) setViewFile({ path: item.path, name: item.name });
                  else {
                    const a = document.createElement("a");
                    a.href = `/api/file-manager/download?path=${encodeURIComponent(item.path)}`;
                    a.download = item.name;
                    a.click();
                  }
                };
                return (
                  <div
                    key={item.path}
                    onClick={item.type === "file" ? handleClick : undefined}
                    className={`flex flex-col items-center p-4 rounded-xl border border-slate-200 bg-slate-50 ${item.type === "file" ? "cursor-pointer hover:bg-slate-100 hover:border-purple-300 transition-colors" : ""}`}
                  >
                    {item.type === "directory" ? (
                      <svg className="w-12 h-12 text-purple-500" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
                      </svg>
                    ) : (
                      <svg className="w-12 h-12 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    )}
                    <span className="mt-2 text-xs text-slate-700 truncate w-full text-center">{item.name}</span>
                    {item.type === "file" && canView && (
                      <span className="text-[10px] text-purple-500 mt-1">Click to view</span>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
        {viewFile && (
          <ViewDocumentModal
            filePath={viewFile.path}
            fileName={viewFile.name}
            onClose={() => setViewFile(null)}
          />
        )}
      </div>
    </div>
  );
}
