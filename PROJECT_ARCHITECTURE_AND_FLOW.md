# 🏗️ File Organizer – How the Project Works  
## Frontend, Backend, and End-to-End Flow

This README explains **how the current project works**: how the frontend connects to the backend, how the C program is invoked, and how data flows from the UI to the file system and back. Use it to explain the architecture in demos or Phase-1.

---

## 📌 1. High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           BROWSER (User)                                     │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      │ HTTP (fetch)
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                     NEXT.JS APP (web/)                                        │
│  ┌─────────────────────┐    ┌──────────────────────────────────────────┐   │
│  │  React Frontend      │    │  API Routes (Backend)                      │   │
│  │  (page.js,           │───▶│  /api/scenario/create-dir                  │   │
│  │   FileExplorer,      │    │  /api/scenario/organize                    │   │
│  │   FileManager)       │    │  /api/scenario/list-workspace             │   │
│  │                      │    │  /api/scenario/delete                     │   │
│  │                      │    │  /api/file-manager/list, delete, rename…   │   │
│  └─────────────────────┘    └──────────────────────────────────────────┘   │
│                                          │                                   │
│                                          │ run-cli.js (when C available)    │
│                                          ▼                                   │
│                              ┌──────────────────────┐                        │
│                              │  spawnSync(CLI_PATH,  │                        │
│                              │    ["create-dir"|    │                        │
│                              │     "organize", ...]) │                        │
│                              └──────────────────────┘                        │
└─────────────────────────────────────────────────────────────────────────────┘
                                          │
                                          │ subprocess
                                          ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  C CLI (organizer_cli) – lives in project root, built by Makefile            │
│  Reads from / writes to: web/workspace/  (path passed as argument)           │
└─────────────────────────────────────────────────────────────────────────────┘
                                          │
                                          │ system calls (mkdir, rename, …)
                                          ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  OPERATING SYSTEM (file system)                                              │
│  All operations are confined to:  web/workspace/  (sandbox)                   │
└─────────────────────────────────────────────────────────────────────────────┘
```

**In one sentence:** The **browser** talks to **Next.js API routes**; for “Create directory” and “Organize”, the API **first tries to run the C CLI** (via `run-cli.js`); if the CLI is not available, it **falls back to Node.js** doing the same file operations. All file work happens under **`web/workspace/`**.

---

## 📌 2. Repo Layout (What Lives Where)

| Path | Role |
|------|------|
| **Project root** | C source and executables: `file_organizer.c`, `organizer_cli.c`, `organizer_cli` (binary), `Makefile` |
| **web/** | Next.js app: frontend (React) + API routes |
| **web/app/page.js** | Main UI: tabs “OS Operations & Logs” and “File Manager”, scenario buttons, Kernel Log, File Explorer |
| **web/app/components/** | `FileExplorer`, `FileManager`, `SyscallInfo`, modals |
| **web/app/api/** | Backend: **scenario** routes (create-dir, organize, list-workspace, delete) and **file-manager** routes (list, delete, rename, upload, …) |
| **web/app/api/lib/run-cli.js** | Bridge: runs the C CLI as a subprocess and parses its JSON output |
| **web/workspace/** | **Sandbox directory**: all create/organize/list/delete operations are restricted to this folder (created by Next.js if missing) |

The **frontend** never talks to the C program directly. It only calls **Next.js API routes** with `fetch()`. The **API** then either runs the C CLI or uses Node.js.

---

## 📌 3. How the Frontend Connects to the Backend

### 3.1 Frontend is a React (Next.js) App

- **Single page** with two tabs: **“OS Operations & Logs”** and **“File Manager”**.
- All server communication is via **HTTP** to **relative URLs** like `/api/scenario/create-dir`, so the same origin as the app (no CORS issues when same host/port).

### 3.2 How the Frontend Calls the Backend

Every server action is a **POST** or **GET** to an API route. Example from `page.js`:

**Create directory + files:**

```javascript
const res = await fetch("/api/scenario/create-dir", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ dirName: createDirName, fileNames }),
});
const data = await res.json();
// data.operations = list of OS ops (syscall, path, success, …)
// data.result   = { dirPath, created }
// data.backend  = "c" | "node"
```

**Organize directory:**

```javascript
const res = await fetch("/api/scenario/organize", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ directoryPath: organizePath || undefined }),
});
const data = await res.json();
// data.operations, data.result (Documents, Images, …), data.backend
```

**List workspace (for File Explorer tree):**

```javascript
const res = await fetch("/api/scenario/list-workspace");
const data = await res.json();
// data.tree = recursive tree of workspace
```

**Delete (from File Explorer or File Manager):**

```javascript
const res = await fetch("/api/scenario/delete", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ targetPath: pathToDelete }),
});
```

So: **frontend → fetch → Next.js API route → (C CLI or Node) → file system → JSON response → frontend updates state (operations, output, file tree).**

---

## 📌 4. How the C CLI Gets Involved (run-cli.js)

### 4.1 Where the CLI Lives

- **Binary:** `organizer_cli` in the **project root** (parent of `web/`).
- Built by: `make organizer_cli` or `make` (compiles `organizer_cli.c`).

### 4.2 How Next.js Runs the C Program

The file **`web/app/api/lib/run-cli.js`**:

1. **Resolves paths**
   - `WORKSPACE = path.join(process.cwd(), "workspace")` → `web/workspace/`
   - `CLI_PATH = path.join(process.cwd(), "..", "organizer_cli")` → project root’s `organizer_cli`

2. **Checks if CLI is runnable**
   - `cliAvailable()` uses `fs.accessSync(CLI_PATH, fs.constants.X_OK)`.

3. **Runs the CLI as a subprocess**
   - Uses Node’s **`spawnSync`** (synchronous, so the API request waits for the CLI to finish).
   - **Create-dir:**  
     `organizer_cli create-dir <workspace> <dirName> <file1> [file2 ...]`
   - **Organize:**  
     `organizer_cli organize <workspace> [subpath]`  
     e.g. `organizer_cli organize /path/to/web/workspace my_folder`

4. **Parses output**
   - The C program prints **one JSON line** to **stdout** (last line is the result).
   - `run-cli.js` does: `JSON.parse(line)` and returns `{ operations, result, error }`.

So the **connection** between Next.js and the C backend is: **no HTTP, no socket** — just **spawn the binary, pass args, read stdout**.

### 4.3 C CLI Interface (Contract)

| Command | Args | Meaning |
|---------|------|--------|
| `create-dir` | `workspace dirName file1 [file2 ...]` | Create `workspace/dirName/` and empty files `file1`, `file2`, … |
| `organize` | `workspace [subpath]` | Organize `workspace` or `workspace/subpath` into Documents/Images/Audio/Videos/Others |

The C program **always** prints a single JSON object (one line) to stdout, e.g.:

```json
{"operations":[{"id":1,"op":"mkdir","description":"Create directory","syscall":"mkdir(2)","path":"/abs/path","path2":null,"success":true,"error":""},...],"result":{...}}
```

The API expects that and passes **operations** and **result** (and optional **error**) back to the frontend.

---

## 📌 5. Scenario Flows (Create Dir & Organize)

### 5.1 Create Directory + Files

1. User fills **directory name** and **file names** (one per line) in the “Create & Populate” card and clicks **Run Scenario**.
2. Frontend sends **POST** to `/api/scenario/create-dir` with `{ dirName, fileNames }`.
3. **create-dir/route.js**:
   - Ensures `workspace` exists.
   - Calls **`runCreateDir(dirName, fileNames)`** from `run-cli.js`.
   - If CLI returns data: respond with `operations`, `result`, `backend: "c"`.
   - If CLI not available or fails: **fallback** with Node: `fs.mkdir`, `fs.writeFile`, build same `operations` and `result`, `backend: "node"`.
4. Frontend stores `data.operations` in **Kernel Log** state and `data.result` in **Result Analysis**; refreshes **File Explorer** via **GET** `/api/scenario/list-workspace`.

### 5.2 Organize Directory

1. User selects a **target directory** (from dropdown, optionally filtered by search) and clicks **Run Organize**.
2. Frontend sends **POST** to `/api/scenario/organize` with `{ directoryPath }` (can be empty for root).
3. **organize/route.js**:
   - Tries **`runOrganize(directoryPath)`** (run-cli).
   - If CLI returns data: respond with `operations`, `result` (Documents, Images, etc.), `backend: "c"`.
   - Else **fallback**: Node `fs.readdir`, `fs.mkdir`, `fs.rename`, build `operations` and `result`, `backend: "node"`.
4. Frontend updates Kernel Log, Result Analysis, and File Explorer (list-workspace again).

So in both flows: **frontend → API route → (C CLI or Node) → workspace on disk → JSON → frontend**.

---

## 📌 6. File Explorer and File Manager

### 6.1 File Explorer (OS Operations tab)

- **Data:** Fetched by **GET** `/api/scenario/list-workspace`. Returns a **recursive tree** of `web/workspace/`.
- **Actions:** Delete file/folder. Delete sends **POST** `/api/scenario/delete` with `targetPath`; response includes an **operation** object (syscall, path, success), which is prepended to the **Kernel Log**.
- **Non-empty folder:** Delete opens a confirmation modal; confirm again sends the same delete API.

### 6.2 File Manager (second tab)

- **Data:** **GET** `/api/file-manager/list?path=<relativePath>` to list one directory at a time (flat list with metadata: size, modified, type).
- **Actions:** Implemented by other file-manager API routes, e.g.:
  - **delete** (single/bulk)
  - **rename**
  - **upload**
  - **create-folder**
  - **download**, **view**
- When an operation is done, the frontend can push an **operation** into the Kernel Log and refresh the tree (same pattern as scenario delete).

So: **File Explorer** = tree over workspace + delete (scenario API). **File Manager** = folder-by-folder listing + full CRUD via file-manager API.

---

## 📌 7. Backend: “C” vs “Node” and Fallback

- **Backend: "c"**  
  The API used the **C CLI** (run-cli.js ran `organizer_cli` and got valid JSON). All file operations were done by the C program (real OS system calls in the CLI process).

- **Backend: "node"**  
  The API did **not** use the C CLI (binary missing, not executable, or CLI failed). The **same logical operations** (mkdir, create file, rename, etc.) are done in Node with `fs.mkdir`, `fs.writeFile`, `fs.rename`, etc. The response shape is the same so the frontend does not need to change.

The UI shows which backend was used (e.g. “Backend: C (Syscalls)” or “Backend: Node.js (Fallback)”).

---

## 📌 8. Workspace Sandbox

- **All** create-dir, organize, list-workspace, delete, and file-manager operations that touch the disk are restricted to **`web/workspace/`** (or subpaths inside it).
- Paths from the client are **normalized** and **stripped of `..`** so you cannot escape the workspace.
- So: one safe directory for the whole app; no access to the rest of the machine from the UI.

---

## 📌 9. End-to-End Data Flow Summary

| Step | Who | What |
|------|-----|------|
| 1 | User | Clicks “Run Scenario” (create-dir) or “Run Organize”, or uses File Explorer / File Manager |
| 2 | React | `fetch("/api/scenario/...")` or `fetch("/api/file-manager/...")` with JSON body if POST |
| 3 | Next.js | Route handler runs (e.g. create-dir/route.js, organize/route.js) |
| 4 | run-cli.js | If scenario create-dir/organize: spawn `organizer_cli` with workspace path and args; read stdout; parse JSON |
| 5 | C CLI | Runs system calls (mkdir, rename, …) inside `workspace/`; prints one JSON line to stdout and exits |
| 6 | Route | Returns JSON `{ operations, result, backend, error? }` to the client |
| 7 | React | Sets state (operations → Kernel Log, result → Result Analysis); refetches list-workspace if needed; re-renders |

---

## 📌 10. How to Explain It in a Demo or Viva

- **“How does the frontend connect to the backend?”**  
  The frontend is a React app in Next.js. It only talks to the backend via **HTTP**: `fetch("/api/...")`. There is no direct connection from the browser to the C program.

- **“Where is the C program used?”**  
  The C program (`organizer_cli`) is run **by the Next.js server** when you use “Create directory + files” or “Organize”. A small bridge module (`run-cli.js`) runs the CLI as a **subprocess** (Node `spawnSync`), passes the workspace path and arguments, and parses the **last line of stdout** as JSON. That JSON is what the API returns to the frontend.

- **“What if the C program is not available?”**  
  The same API routes implement the same behavior in **Node.js** (mkdir, writeFile, rename, etc.) and return the same JSON shape. The frontend just sees `backend: "c"` or `backend: "node"` and the same operations/result.

- **“Where do files actually get created?”**  
  All under **`web/workspace/`**. The API and the CLI both receive (or use) that path so everything stays in one sandbox.

You can use this document together with the repo layout and the code to walk through the full flow from button click to disk to UI update.
