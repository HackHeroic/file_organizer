"use client";

export default function FileManagerDeleteModal({ targets, onConfirm, onCancel }) {
  if (!targets || targets.length === 0) return null;

  const isPlural = targets.length > 1;
  const hasFoldersWithContent = targets.some(
    (t) => t.type === "directory" && (t.childrenCount ?? 0) > 0
  );

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
      <div
        className="bg-white rounded-2xl shadow-2xl p-6 max-w-md w-full border border-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col items-center text-center">
          <div className="w-12 h-12 bg-red-100 text-red-500 rounded-full flex items-center justify-center mb-4">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </div>
          <h3 className="text-lg font-bold text-slate-800 mb-2">
            {isPlural ? `Delete ${targets.length} items?` : "Delete this item?"}
          </h3>
          <p className="text-sm text-slate-500 mb-4">
            {hasFoldersWithContent
              ? "Some folders contain files. They will be removed permanently."
              : "This action cannot be undone."}
          </p>
          {targets.length <= 5 ? (
            <ul className="text-left text-sm text-slate-600 mb-6 w-full bg-slate-50 rounded-lg p-3 max-h-32 overflow-y-auto">
              {targets.map((t) => (
                <li key={t.path} className="truncate font-mono">
                  {t.name}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-500 mb-6">{targets.length} items selected</p>
          )}
          <div className="flex gap-3 w-full">
            <button
              onClick={onCancel}
              className="flex-1 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              className="flex-1 px-4 py-2 bg-red-500 hover:bg-red-600 text-white text-sm font-medium rounded-xl shadow-lg shadow-red-200 transition-colors"
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
