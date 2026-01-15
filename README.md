# 📂 File Organizer App

A console-based file management application developed in C that demonstrates Operating System file system concepts by automatically organizing files into categorized folders based on their extensions.

![Project Type](https://img.shields.io/badge/Project-Operating%20Systems-blue)
![Language](https://img.shields.io/badge/Language-C-orange)
![Platform](https://img.shields.io/badge/Platform-Linux%20%7C%20macOS%20%7C%20WSL-lightgrey)

---

## 📌 Project Overview

The **File Organizer App** is an Operating Systems mini project that automates file organization by scanning a directory and sorting files into categorized folders based on their file extensions. This project provides hands-on experience with OS-level programming and file system management.

### ✨ Key Features

- 🔍 Automatic directory scanning
- 📁 Smart file categorization by extension
- 🚀 Efficient file system operations using OS system calls
- 🛠️ Cross-platform compatibility (Linux/macOS/WSL)
- 📊 Clean, organized folder structure generation

---

## 🎯 Objectives

- Understand **file system management** in operating systems
- Implement **directory traversal** using system calls
- Organize files automatically based on extensions
- Gain hands-on experience with **OS-level programming in C**

---

## 🧠 Operating System Concepts Demonstrated

| Concept | Implementation |
|---------|----------------|
| **File System Management** | Directory creation and file manipulation |
| **Directory Traversal** | Scanning and iterating through directory entries |
| **System Calls** | Low-level OS operations for file management |
| **File Metadata Handling** | Extracting and processing file properties |

---

## 🛠️ Technologies Used

- **Programming Language:** C
- **Compiler:** GCC
- **Operating System:** Linux / macOS / Windows Subsystem for Linux (WSL)

### 📚 Libraries Used

```c
#include <stdio.h>      // Standard I/O operations
#include <dirent.h>     // Directory operations
#include <string.h>     // String manipulation
#include <sys/stat.h>   // File statistics and directory creation
#include <stdlib.h>     // Standard library functions
```

---

## 📁 File Classification Logic

The application organizes files into the following categories:

| File Type | Extensions | Destination Folder |
|-----------|-----------|-------------------|
| 📄 **Documents** | `.txt`, `.pdf`, `.docx`, `.doc`, `.xlsx`, `.pptx` | `Documents/` |
| 🖼️ **Images** | `.jpg`, `.jpeg`, `.png`, `.gif`, `.bmp`, `.svg` | `Images/` |
| 🎵 **Audio** | `.mp3`, `.wav`, `.aac`, `.flac`, `.ogg` | `Audio/` |
| 🎥 **Videos** | `.mp4`, `.mkv`, `.avi`, `.mov`, `.wmv` | `Videos/` |
| 📦 **Others** | All other file types | `Others/` |

---

## ⚙️ How It Works

```mermaid
graph TD
    A[Start] --> B[User provides directory path]
    B --> C[Scan directory for files]
    C --> D[Extract file extension]
    D --> E[Determine file category]
    E --> F[Create category folder if needed]
    F --> G[Move file to appropriate folder]
    G --> H{More files?}
    H -->|Yes| C
    H -->|No| I[Display success message]
    I --> J[End]
```

1. **Input:** User provides the directory path to organize
2. **Scanning:** Program scans all files in the specified directory
3. **Extraction:** File extensions are extracted using string operations
4. **Organization:** Required folders are created automatically
5. **Movement:** Files are moved into respective folders using OS system calls

---

## 🚀 Installation & Usage

### Prerequisites

- GCC compiler installed on your system
- Linux, macOS, or WSL environment

### Step 1: Clone the Repository

```bash
git clone https://github.com/yourusername/file-organizer.git
cd file-organizer
```

### Step 2: Compile the Program

```bash
gcc file_organizer.c -o organizer
```

Or use the provided Makefile (if available):

```bash
make
```

### Step 3: Run the Program

```bash
./organizer
```

### Step 4: Provide Input

When prompted, enter the directory path you want to organize:

```
Enter the directory path to organize: test_folder
```

### Example Output

**Before Organization:**
```
test_folder/
├── a.txt
├── b.png
├── c.jpg
├── audio.mp4
└── song.mp3
```

**After Organization:**
```
test_folder/
├── Documents/
│   └── a.txt
├── Images/
│   ├── b.png
│   └── c.jpg
├── Videos/
│   └── audio.mp4
├── Audio/
│   └── song.mp3
└── Others/
```

---

## 📖 Code Structure

```
file-organizer/
│
├── file_organizer.c        # Main source code
├── README.md               # Project documentation
├── Makefile                # Build automation (optional)
└── test_folder/            # Sample directory for testing
```

---

## 🔍 Key Functions

| Function | Description |
|----------|-------------|
| `main()` | Entry point, handles user input and orchestrates organization |
| `getFileExtension()` | Extracts file extension from filename |
| `organizeFiles()` | Scans directory and moves files to appropriate folders |
| `createDirectory()` | Creates category folders if they don't exist |
| `moveFile()` | Moves files using system calls |

---

## 🧪 Testing

To test the application:

1. Create a test directory with sample files:
```bash
mkdir test_folder
cd test_folder
touch document.txt image.png song.mp3 video.mp4
cd ..
```

2. Run the organizer:
```bash
./organizer
```

3. Enter `test_folder` when prompted

4. Verify files are organized into proper folders

---

## 🤝 Contributing

Contributions are welcome! Here's how you can help:

1. Fork the repository
2. Create a new branch (`git checkout -b feature/improvement`)
3. Make your changes
4. Commit your changes (`git commit -am 'Add new feature'`)
5. Push to the branch (`git push origin feature/improvement`)
6. Create a Pull Request

---

## 📝 Future Enhancements

- [ ] Add support for custom file categories
- [ ] Implement recursive subdirectory organization
- [ ] Add GUI interface
- [ ] Support for file size-based organization
- [ ] Undo functionality
- [ ] Configuration file for custom extensions
- [ ] Progress bar for large directories
- [ ] Duplicate file handling

---

