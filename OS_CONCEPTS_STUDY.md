# 🧠 Operating System Concepts – File Organizer Project  
## Study Guide for Phase-1 Submission & Viva

This document explains **all OS concepts** used in the File Organizer project, aligned with **File-Organiser.pdf** and the actual code in `organizer_cli.c` and `file_organizer.c`. Use it to prepare for Phase-1 evaluation and any questions on memory, renaming, and core OS operations.

---

## 📌 1. How Memory Works in Our Program

The OS gives each process its own **virtual address space**. Our program uses three kinds of memory:

### 1.1 Stack Memory

**What it is:** A region of memory that grows/shrinks automatically. Used for **local variables** and **function call frames** (return addresses, parameters).

**In our code:**

| Location | Example | Why stack? |
|----------|---------|------------|
| `file_organizer.c` | `char dirName[256];` | Local variable → compiler puts it on stack |
| `file_organizer.c` | `char docs[50][256], imgs[50][256], ...` | Fixed-size arrays inside a function |
| `organizer_cli.c` | `char dir_path[MAX_PATH];`, `char old_path[MAX_PATH]` | Local buffers in functions |
| `organizer_cli.c` | `OpRec ops[MAX_OPS];` (static but same idea for locals) | Fixed-size storage |

**Key points for viva:**
- **Allocated** when the function is called.
- **Freed automatically** when the function returns (no `free()` needed).
- **Size is fixed at compile time** (e.g. 256 bytes for `dirName`).

---

### 1.2 Heap Memory

**What it is:** Dynamically allocated memory. You request it with `malloc()`/`calloc()` and must free it with `free()`.

**In our code:**

| Location | Example | Why heap? |
|----------|---------|-----------|
| `organizer_cli.c` | `list[*cnt] = strdup(entry->d_name);` | `strdup()` allocates on heap; we `free(docs[x])` later |
| Internally | `opendir()`, `fopen()` | These **library/OS functions** allocate internal buffers on the heap and return pointers (we don’t call `malloc` ourselves for them). |

#### 1.2.1 Dynamic allocation: `malloc`, `calloc`, `realloc`, `free`

Heap memory is requested in C using these standard library functions (from `<stdlib.h>`). They get memory from the **heap** and return a pointer; you must **free** it when done to avoid leaks.

| Function | Signature (simplified) | What it does |
|----------|-------------------------|--------------|
| **malloc** | `void* malloc(size_t size);` | Allocates **size** bytes. Contents are **uninitialized** (garbage). Returns `NULL` if allocation fails. |
| **calloc** | `void* calloc(size_t nmemb, size_t size);` | Allocates **nmemb × size** bytes (e.g. 10 ints: `calloc(10, sizeof(int))`). All bytes are **zero-initialized**. Returns `NULL` on failure. |
| **realloc** | `void* realloc(void *ptr, size_t new_size);` | Resizes a block previously allocated by malloc/calloc/realloc. May move the block and copy data. If `ptr` is `NULL`, behaves like `malloc(new_size)`. Returns new pointer or `NULL` on failure. |
| **free** | `void free(void *ptr);` | Releases the memory pointed to by **ptr** (must be a pointer returned by malloc/calloc/realloc). After `free(ptr)`, do not use `ptr` again (“use after free” is undefined behaviour). |

**Typical usage:**

```c
// malloc: raw bytes, uninitialized
char *buf = malloc(256);
if (buf) {
    // use buf ...
    free(buf);
}

// calloc: good for arrays, zeroed
int *arr = calloc(10, sizeof(int));  // 10 ints, all 0
if (arr) {
    // use arr ...
    free(arr);
}

// realloc: grow/shrink
char *p = malloc(100);
p = realloc(p, 200);  // now 200 bytes (may have moved)
if (p) free(p);
```

**In our project:** We don’t call `malloc`/`calloc` directly. We use **`strdup()`**, which is like `malloc(strlen(s)+1)` + `strcpy`; it allocates on the heap, so we **must** call **`free()`** on each pointer we get from `strdup()` (as we do in `organizer_cli.c` for the file-name lists).

**Viva tip:** “malloc gives uninitialized bytes; calloc gives zero-initialized blocks and is often used for arrays. We must free whatever we allocate with malloc/calloc/realloc to avoid memory leaks.”

**Key points for viva:**
- **Explicit allocation** (e.g. `strdup` → malloc inside).
- **Explicit deallocation** – we must `free()` what we `strdup()`.
- **OS/library** use heap for directory streams, FILE buffers, etc.

---

### 1.3 Buffer Memory (I/O Buffering)

**What it is:** Memory used to **batch** reads/writes so the OS doesn’t hit the disk for every single byte. `FILE*` (from `fopen`) uses an internal buffer.

**In our code:**

| Location | Example | Role of buffer |
|----------|---------|----------------|
| `file_organizer.c` | `FILE *fp = fopen(filePath, "w");` then `fclose(fp)` | File I/O goes through a buffer; `fclose` flushes it |
| `file_organizer.c` | `FILE *json = fopen("output.json", "w");` + `fprintf(json, ...)` | Each `fprintf` may write into buffer first; buffer is written to disk when full or on `fclose` |
| `organizer_cli.c` | `printf("{\"operations\":[...]");` | stdout is buffered; output may sit in buffer until newline or flush |

**Key points for viva:**
- **Buffering** = temporary storage between your program and the disk.
- **Efficiency:** Fewer system calls and disk accesses.
- **FILE*** abstracts the buffer; we don’t manage it ourselves.

---

### 1.4 Memory Safety (Buffer Overflow Prevention)

**What it is:** Avoiding writing past the end of an array, which can crash the program or create security issues.

**In our code:**

| Location | Example | How it prevents overflow |
|----------|---------|---------------------------|
| `file_organizer.c` | `scanf("%255s", dirName);` with `char dirName[256]` | `%255s` limits input to 255 chars + `\0` → fits in 256 bytes |
| `organizer_cli.c` | `strncpy(r->op, op, sizeof(r->op) - 1); r->op[sizeof(r->op)-1] = '\0'` | Never copy more than the field size; always null-terminate |
| `organizer_cli.c` | `snprintf(dir_path, sizeof(dir_path), "%s/%s", ...)` | `snprintf` is bounded by `sizeof(dir_path)` |

**Key point for viva:** We use **bounded** functions (`%255s`, `strncpy`, `snprintf`) and **fixed maximum sizes** so we never write beyond allocated memory.

---

## 📌 2. How Renaming (Moving Files) Happens

We **move** files by **renaming** them from one path to another. That is done with the **rename(2)** system call.

### 2.1 What `rename(old_path, new_path)` Does

- **Same filesystem:** The OS only updates **metadata** (directory entries). The file’s **data blocks on disk do not move**. So “rename” is really “change the path (directory entry)” → very fast and **atomic**.
- **Different filesystem:** The OS typically **copies** the file to the new location and then **deletes** the old one (so it’s not atomic in the same way).

**In our code:**

```c
// organizer_cli.c (and similarly in file_organizer.c)
snprintf(old_path, sizeof(old_path), "%s/%s", base_path, entry->d_name);
snprintf(new_path, sizeof(new_path), "%s/%s", dest, entry->d_name);
if (rename(old_path, new_path) == 0) {
    add_op("rename", "Move file to category", "rename(2)", old_path, new_path, 1, NULL);
    // ...
}
```

Here we **move** a file from e.g. `workspace/file.txt` to `workspace/Documents/file.txt`. Same filesystem → one atomic metadata update.

### 2.2 Why Use `rename()` Instead of Copy + Delete?

| Approach | Pros | Cons |
|----------|------|------|
| **rename(old, new)** | **Atomic** (all-or-nothing), **no data copy** on same FS, **fast**, single system call | Cross-FS may fall back to copy+delete |
| Copy then delete | Works across filesystems | Not atomic (copy can succeed, delete can fail); slower; uses extra disk space and I/O |

**Viva answer:** “We use `rename()` because it is atomic and faster: on the same filesystem the OS only updates directory metadata and does not copy file data. So it’s the right OS-level way to move a file.”

### 2.3 Atomicity

**Atomic** = the operation is done **as a single indivisible step**. Either the full rename succeeds, or nothing changes. There is no intermediate state where the file exists in both places or in neither.

---

## 📌 3. Core Atomic OS Operations We Use

These are **system calls** (or built on system calls). The kernel performs them; from the process’s view they are single operations.

### 3.1 Directory Operations

| Function | System call (under the hood) | What it does |
|----------|------------------------------|--------------|
| `opendir(path)` | Uses **open(2)** / **getdents(2)** (or similar) | Opens directory stream; returns `DIR*`; **allocates resources** (kernel/heap). |
| `readdir(DIR*)` | **getdents(2)** (or readdir implementation) | Returns next directory entry (`struct dirent`: name, type, etc.). |
| `closedir(DIR*)` | **close(2)** | Closes directory stream; **frees kernel/resources**. |

**In our code:** We use them in `organize_directory()` to iterate over all files in `base_path`.

**Viva:** “When `opendir()` is called, the OS checks permissions and opens the directory, returning a pointer to a directory stream. We then use `readdir()` in a loop to get each entry.”

### 3.2 File System Operations

| Function | System call | What it does |
|----------|-------------|--------------|
| `mkdir(path, mode)` | **mkdir(2)** | Creates a directory; **atomic** creation of one directory. |
| `rename(old, new)` | **rename(2)** | Changes name/path of file or directory; **atomic** on same filesystem. |
| `fopen(path, mode)` | **open(2)** | Opens file; returns `FILE*` (buffered). |
| `fclose(FILE*)` | **close(2)** | Closes file and flushes buffer. |
| `stat(path, &st)` | **stat(2)** | Fills `struct stat` with metadata (type, size, permissions, etc.). |

**In our code:**
- `mkdir(dir_path, 0777)` — create directory with permissions.
- `rename(old_path, new_path)` — move file into category folder.
- `fopen` / `fclose` — create empty files, write `output.json`.
- `stat(ent_path, &st)` and `S_ISDIR(st.st_mode)` — skip subdirectories (organizer_cli.c).

### 3.3 Process Execution: User Mode vs Kernel Mode

- **User mode:** Our C code runs here. Cannot directly access hardware or kernel data structures.
- **Kernel mode:** When we call e.g. `rename()`, the **system call** switches the CPU to kernel mode. The kernel performs the operation (e.g. updating the file system) and then returns to user mode.

So: **program runs as a user-mode process; system calls temporarily switch to kernel mode** to do the actual file/directory work.

---

## 📌 4. File Metadata and Permissions

### 4.1 File Metadata

- **struct dirent** (from `readdir()`): gives at least **name** (`d_name`) and often **type** (`d_type`, e.g. `DT_DIR` for directory).
- **struct stat** (from `stat(2)`): gives type (`st_mode`), size, permissions, timestamps, etc.

We use **metadata** to:
- Skip `.` and `..`.
- Skip subdirectories (`S_ISDIR(st.st_mode)` in organizer_cli.c) or `entry->d_type == DT_DIR` in file_organizer.c.
- Get file name to compute extension and destination path.

### 4.2 File Permissions (UNIX Model)

```c
mkdir(directory, 0777);
```

- **0777** = octal: **owner**, **group**, **others** each get **read (4) + write (2) + execute (1)** = 7.
- So: **rwxrwxrwx** — full access for everyone (typical for a local workspace; in production you might use e.g. 0755).

**Viva:** “We use the UNIX permission model: read, write, execute bits for owner, group, and others. 0777 means read-write-execute for all.”

---

## 📌 5. Quick Reference: Where Each Concept Appears in Code

| OS concept | Where in code |
|------------|----------------|
| Stack (local variables/arrays) | `char dirName[256]`, `char docs[50][256]`, `char dir_path[MAX_PATH]`, etc. |
| Heap (dynamic) | `strdup(entry->d_name)` and `free(docs[x])` in organizer_cli.c |
| Buffering | `FILE *fp = fopen(...)`, `fprintf(json, ...)`, `printf(...)` |
| Memory safety | `scanf("%255s", ...)`, `strncpy`, `snprintf(..., sizeof(buf), ...)` |
| Directory read | `opendir`, `readdir`, `closedir`, `struct dirent` |
| Create directory | `mkdir(path, 0777)` |
| Move file | `rename(old_path, new_path)` |
| Create file | `fopen(path, "w")` then `fclose` |
| File metadata | `stat(ent_path, &st)`, `S_ISDIR(st.st_mode)`, `entry->d_name`, `entry->d_type` |
| Permissions | `0777` in `mkdir` |

---

## 📌 6. Sample Viva / Interview Questions & Answers

**Q: Is this a system program or an application program?**  
**A:** It is a **system-level utility** (application) that uses **OS interfaces** (system calls) for file and directory operations. So it’s an application that does “system programming.”

**Q: Where is memory allocated in your program?**  
**A:**  
- **Stack:** Local variables and fixed-size arrays (e.g. `dirName[256]`, `docs[50][256]`, path buffers).  
- **Heap:** Through `strdup()` for file names we keep in lists, and internally by `opendir()`/`fopen()`.  
- **Buffers:** File I/O and stdout use buffers managed by the C library/OS via `FILE*`.

**Q: What is the difference between malloc and calloc?**  
**A:** **malloc(size)** allocates `size` bytes on the heap; the contents are **uninitialized**. **calloc(n, size)** allocates `n × size` bytes and **zero-initializes** all bytes (useful for arrays). Both return a pointer that must be passed to **free()** when no longer needed. **realloc(ptr, new_size)** resizes an existing block (may move it).

**Q: Why use `rename()` instead of copy + delete?**  
**A:** `rename()` is **atomic** and **faster** on the same filesystem: the OS only updates directory metadata and does not copy file data. So it’s the correct OS-level way to move a file.

**Q: What happens when `opendir()` is called?**  
**A:** The OS checks path and permissions, opens the directory, and returns a **directory stream** pointer (`DIR*`). We then use `readdir()` to read each entry (e.g. file name and type) from that stream.

**Q: What is an atomic operation?**  
**A:** An operation that **either completes fully or has no effect**; no partial state. For example, `rename(old, new)` on the same filesystem is atomic: the file is either at the old path or the new path, never both or neither due to this call.

**Q: How do we avoid buffer overflow in this project?**  
**A:** We use **bounded** operations: `scanf("%255s", ...)` for 256-byte buffers, `strncpy` with size limits and null termination, and `snprintf(..., sizeof(buffer), ...)` so we never write past the end of our arrays.

**Q: What is the role of `stat()` in the organizer?**  
**A:** We use `stat(ent_path, &st)` to get **file metadata**. `S_ISDIR(st.st_mode)` tells us if the entry is a directory so we can **skip subdirectories** and only move files.

---

## 📌 7. Summary for Phase-1

- **Memory:** Stack (locals, fixed arrays), heap (`strdup`/malloc inside libs), buffers (FILE*), and safety (bounded scanf/strncpy/snprintf).
- **Renaming:** `rename(2)` moves files by updating directory metadata; same FS = no data copy, atomic and fast.
- **Core OS operations:** `opendir`/`readdir`/`closedir`, `mkdir`, `rename`, `fopen`/`fclose`, `stat` — all are (or use) system calls; execution switches to kernel mode during the call.
- **Metadata & permissions:** `struct dirent`, `struct stat`, and `mkdir(..., 0777)` for the UNIX permission model.

Use this document together with **File-Organiser.pdf** and the actual source files to explain every concept with a concrete code reference. Good luck for your Phase-1 submission.
