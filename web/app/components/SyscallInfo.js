"use client";

const SYSCALL_DATA = {
    "mkdir": {
        name: "mkdir",
        summary: "Create a directory",
        desc: "The `mkdir` system call creates a new directory with the specified name and mode (permissions). It's the fundamental way folders are created in Unix-like systems.",
        c_code: `
#include <sys/stat.h>

int status = mkdir("path/to/folder", 0777);

if (status == 0) {
    // Directory created
} else {
    // Error handling
}`,
        node_code: `
import fs from 'fs/promises';

await fs.mkdir('path/to/folder', { recursive: true });
`
    },
    "open": {
        name: "open",
        summary: "Open or create a file",
        desc: "The `open` syscall opens a file. If called with `O_CREAT`, it creates a new file. It returns a file descriptor (an integer) used for subsequent read/write operations.",
        c_code: `
#include <fcntl.h>

// Open for writing, create if not exists
int fd = open("file.txt", O_WRONLY | O_CREAT, 0644);`,
        node_code: `
import fs from 'fs/promises';

// High-level wrapper often used instead of raw open
const fileHandle = await fs.open('file.txt', 'w');
`
    },
    "write": {
        name: "write",
        summary: "Write data to a file",
        desc: "Writes a sequence of bytes from a buffer to an open file descriptor.",
        c_code: `
#include <unistd.h>

const char *data = "Hello Kernel";
write(fd, data, strlen(data));`,
        node_code: `
// In Node, we often use high-level methods:
await fs.writeFile('file.txt', 'Hello User space');

// Or with a handle:
await fileHandle.write('Data');
`
    },
    "readdir": {
        name: "getdents / readdir",
        summary: "Read directory entries",
        desc: "Reads the contents of a directory. In C, `readdir` (libc) uses the `getdents` system call underneath to get the list of files and subfolders.",
        c_code: `
#include <dirent.h>

DIR *d = opendir(".");
struct dirent *dir;
while ((dir = readdir(d)) != NULL) {
    printf("%s\\n", dir->d_name);
}
closedir(d);`,
        node_code: `
import fs from 'fs/promises';

const files = await fs.readdir('.'); 
// Returns array of filenames
`
    },
    "rename": {
        name: "rename",
        summary: "Move or rename a file",
        desc: "Renames a file, moving it between directories if necessary. It is an atomic operation on POSIX systems.",
        c_code: `
#include <stdio.h>

// Move/Rename is just one call
rename("old_folder/file.txt", "new_folder/file.txt");`,
        node_code: `
import fs from 'fs/promises';

await fs.rename('old.txt', 'new.txt');
`
    },
    "unlink": {
        name: "unlink",
        summary: "Delete a file",
        desc: "Deletes a name from the filesystem. If that name was the last link to a file and no processes have it open, the file is deleted and the space it was using is made available for reuse.",
        c_code: `
#include <unistd.h>

int status = unlink("file_to_delete.txt");`,
        node_code: `
import fs from 'fs/promises';

await fs.unlink('file_to_delete.txt');
`
    },
    "rmdir": {
        name: "rmdir",
        summary: "Delete a directory",
        desc: "Deletes a directory, which must be empty.",
        c_code: `
#include <unistd.h>

int status = rmdir("empty_folder");`,
        node_code: `
import fs from 'fs/promises';

await fs.rmdir('empty_folder');
`
    }
};

export default function SyscallInfo({ syscall, onClose }) {
    // Extract base name (e.g., "mkdir(2)" -> "mkdir")
    const baseDetails = Object.values(SYSCALL_DATA).find(s => syscall.toLowerCase().includes(s.name.toLowerCase()));

    if (!baseDetails) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm" onClick={onClose}>
            <div
                className="glass-panel w-full max-w-2xl rounded-2xl shadow-2xl p-6 relative bg-white"
                onClick={e => e.stopPropagation()}
            >
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"
                >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>

                <div className="flex items-center gap-3 mb-6">
                    <div className="p-3 bg-purple-100 text-purple-600 rounded-xl">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-slate-900">{baseDetails.name} <span className="text-slate-400 font-normal text-base ml-1">syscall</span></h3>
                        <p className="text-purple-600 font-medium text-sm">{baseDetails.summary}</p>
                    </div>
                </div>

                <p className="text-slate-600 leading-relaxed mb-6">
                    {baseDetails.desc}
                </p>

                <div className="grid md:grid-cols-2 gap-4">
                    <div className="bg-slate-900 rounded-xl p-4 overflow-hidden border border-slate-800">
                        <div className="flex items-center justify-between mb-2 border-b border-slate-700 pb-2">
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">C Implementation</span>
                            <span className="text-[10px] text-slate-500 font-mono">system_call</span>
                        </div>
                        <pre className="font-mono text-xs text-emerald-400 overflow-x-auto whitespace-pre-wrap">
                            {baseDetails.c_code.trim()}
                        </pre>
                    </div>

                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 overflow-hidden">
                        <div className="flex items-center justify-between mb-2 border-b border-slate-200 pb-2">
                            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Node.js Equivalent</span>
                            <span className="text-[10px] text-slate-400 font-mono">wrapper</span>
                        </div>
                        <pre className="font-mono text-xs text-slate-700 overflow-x-auto whitespace-pre-wrap">
                            {baseDetails.node_code.trim()}
                        </pre>
                    </div>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-100 flex justify-end">
                    <button
                        onClick={onClose}
                        className="bg-slate-900 hover:bg-slate-800 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors"
                    >
                        Got it
                    </button>
                </div>
            </div>
        </div>
    );
}
