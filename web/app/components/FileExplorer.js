"use client";

import { useState } from "react";

function FileIcon({ type }) {
    if (type === "directory") {
        return (
            <svg className="w-4 h-4 shrink-0 text-purple-600" fill="currentColor" viewBox="0 0 20 20" aria-hidden>
                <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
            </svg>
        );
    }
    return (
        <svg className="w-4 h-4 shrink-0 text-slate-500" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
    );
}

function TreeNode({ node, onDelete, level = 0 }) {
    const [isOpen, setIsOpen] = useState(false);
    const [isHovered, setIsHovered] = useState(false);

    const toggleOpen = () => {
        if (node.type === "directory") {
            setIsOpen(!isOpen);
        }
    };

    return (
        <div className="select-none">
            <div
                className={`flex items-center gap-2 py-1 px-2 rounded-md transition-colors cursor-pointer ${isHovered ? "bg-purple-50" : ""
                    }`}
                style={{ paddingLeft: `${level * 12 + 8}px` }}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
                onClick={toggleOpen}
            >
                <div className="flex items-center gap-1.5 shrink-0 min-w-[1.25rem]">
                    {node.type === "directory" ? (
                        <span className="text-slate-500 text-[10px] font-medium w-3 text-center">{isOpen ? "▾" : "▸"}</span>
                    ) : (
                        <span className="w-3 block" aria-hidden />
                    )}
                    <FileIcon type={node.type} />
                </div>

                <span className="text-sm text-slate-700 truncate flex-1">{node.name}</span>

                {isHovered && (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onDelete(node.path, node.type, node.children && node.children.length > 0);
                        }}
                        className="text-xs text-red-500 hover:text-red-700 font-medium px-1.5 py-0.5 rounded hover:bg-red-50"
                        title="Delete"
                    >
                        Del
                    </button>
                )}
            </div>

            {
                isOpen && node.children && (
                    <div>
                        {node.children.map((child) => (
                            <TreeNode key={child.path} node={child} onDelete={onDelete} level={level + 1} />
                        ))}
                    </div>
                )
            }
        </div >
    );
}

export default function FileExplorer({ tree, onDelete, onRefresh }) {
    if (!tree || tree.length === 0) {
        return (
            <div className="glass-card rounded-2xl h-full flex flex-col items-center justify-center text-slate-400 text-sm p-8">
                <svg className="w-12 h-12 mb-3 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" /></svg>
                Workspace is empty
            </div>
        )
    }

    return (
        <div className="glass-card rounded-2xl overflow-hidden flex flex-col h-full shadow-sm">
            <div className="px-4 py-3 flex justify-between items-center border-b border-slate-100 bg-white/30">
                <h3 className="font-semibold text-slate-700 text-xs uppercase tracking-wider">Workspace Explorer</h3>
                <button
                    onClick={onRefresh}
                    className="text-slate-400 hover:text-purple-600 transition-colors p-1 rounded hover:bg-white/50"
                    title="Refresh"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                </button>
            </div>
            <div className="p-3 overflow-y-auto flex-1 scrollbar-thin scrollbar-thumb-slate-200">
                {tree.map((node) => (
                    <TreeNode key={node.path} node={node} onDelete={onDelete} />
                ))}
            </div>
        </div>
    );
}
