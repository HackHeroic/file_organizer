/*
 * CLI for File Organizer - outputs JSON for use by Next.js API.
 * Usage:
 *   organizer_cli create-dir <workspace> <dirName> <file1> [file2 ...]
 *   organizer_cli organize <workspace> [subpath]
 */

#define _POSIX_C_SOURCE 200809L
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <dirent.h>
#include <sys/stat.h>
#include <errno.h>
#include <time.h>
#include <strings.h>

#define MAX_OPS 256
#define MAX_PATH 512
#define MAX_FILES 64

typedef struct {
    int id;
    char op[32];
    char description[64];
    char syscall[48];
    char path[MAX_PATH];
    char path2[MAX_PATH];
    int success;
    char error[128];
} OpRec;

static OpRec ops[MAX_OPS];
static int nops;

static void json_escape(const char *s, char *out, size_t outsz) {
    size_t j = 0;
    for (; *s && j < outsz - 2; s++) {
        if (*s == '"' || *s == '\\') { out[j++] = '\\'; out[j++] = *s; }
        else if (*s == '\n') { out[j++] = '\\'; out[j++] = 'n'; }
        else out[j++] = *s;
    }
    out[j] = '\0';
}

static void add_op(const char *op, const char *desc, const char *syscall,
                   const char *path, const char *path2, int success, const char *err) {
    if (nops >= MAX_OPS) return;
    OpRec *r = &ops[nops++];
    r->id = nops;
    strncpy(r->op, op, sizeof(r->op) - 1); r->op[sizeof(r->op)-1] = '\0';
    strncpy(r->description, desc, sizeof(r->description) - 1); r->description[sizeof(r->description)-1] = '\0';
    strncpy(r->syscall, syscall, sizeof(r->syscall) - 1); r->syscall[sizeof(r->syscall)-1] = '\0';
    strncpy(r->path, path ? path : "", sizeof(r->path) - 1); r->path[sizeof(r->path)-1] = '\0';
    strncpy(r->path2, path2 ? path2 : "", sizeof(r->path2) - 1); r->path2[sizeof(r->path2)-1] = '\0';
    r->success = success;
    strncpy(r->error, err ? err : "", sizeof(r->error) - 1); r->error[sizeof(r->error)-1] = '\0';
}

static void print_json_result(const char *result_json) {
    printf("{\"operations\":[");
    for (int i = 0; i < nops; i++) {
        OpRec *r = &ops[i];
        char pe[MAX_PATH * 2], p2e[MAX_PATH * 2], ee[256];
        json_escape(r->path, pe, sizeof(pe));
        json_escape(r->path2, p2e, sizeof(p2e));
        json_escape(r->error, ee, sizeof(ee));
        if (i) printf(",");
        printf("{\"id\":%d,\"op\":\"%s\",\"description\":\"%s\",\"syscall\":\"%s\",\"path\":\"%s\",\"path2\":\"%s\",\"success\":%s,\"error\":\"%s\"}",
               r->id, r->op, r->description, r->syscall, pe, p2e, r->success ? "true" : "false", ee);
    }
    printf("],\"result\":%s}\n", result_json ? result_json : "null");
}

static int create_dir_and_files(const char *workspace, const char *dir_name, char *files[], int nfiles) {
    char dir_path[MAX_PATH];
    snprintf(dir_path, sizeof(dir_path), "%s/%s", workspace, dir_name);

    if (mkdir(dir_path, 0777) == 0) {
        add_op("mkdir", "Create directory", "mkdir(2)", dir_path, NULL, 1, NULL);
    } else {
        add_op("mkdir", "Create directory", "mkdir(2)", dir_path, NULL, 0, strerror(errno));
        if (errno != EEXIST) return -1;
    }

    for (int i = 0; i < nfiles; i++) {
        char file_path[MAX_PATH];
        snprintf(file_path, sizeof(file_path), "%s/%s", dir_path, files[i]);
        FILE *fp = fopen(file_path, "w");
        if (fp) {
            fclose(fp);
            add_op("writeFile", "Create file", "open(2)/write(2)/close(2)", file_path, NULL, 1, NULL);
        } else {
            add_op("writeFile", "Create file", "open(2)/write(2)/close(2)", file_path, NULL, 0, strerror(errno));
        }
    }

    char escaped[MAX_PATH * 2];
    json_escape(dir_path, escaped, sizeof(escaped));
    char result[512];
    snprintf(result, sizeof(result), "{\"dirPath\":\"%s\",\"created\":%d}", escaped, nfiles);
    print_json_result(result);
    return 0;
}

static int is_doc(const char *ext) {
    return strcmp(ext, ".txt")==0 || strcmp(ext, ".pdf")==0 || strcmp(ext, ".docx")==0 ||
           strcmp(ext, ".doc")==0 || strcmp(ext, ".xlsx")==0 || strcmp(ext, ".pptx")==0;
}
static int is_img(const char *ext) {
    return strcmp(ext, ".jpg")==0 || strcmp(ext, ".jpeg")==0 || strcmp(ext, ".png")==0 ||
           strcmp(ext, ".gif")==0 || strcmp(ext, ".bmp")==0 || strcmp(ext, ".svg")==0;
}
static int is_aud(const char *ext) {
    return strcmp(ext, ".mp3")==0 || strcmp(ext, ".wav")==0 || strcmp(ext, ".aac")==0 ||
           strcmp(ext, ".flac")==0 || strcmp(ext, ".ogg")==0;
}
static int is_vid(const char *ext) {
    return strcmp(ext, ".mp4")==0 || strcmp(ext, ".mkv")==0 || strcmp(ext, ".avi")==0 ||
           strcmp(ext, ".mov")==0 || strcmp(ext, ".wmv")==0;
}

/* ---- TEXT TEMPLATES FOR .txt FILES ---- */
static const char *text_templates[] = {
    "Meeting Notes - Q4 Planning\n\nDate: 2024-11-15\nAttendees: Alice, Bob, Charlie\n\nAgenda:\n1. Budget review for next quarter\n2. New product roadmap discussion\n3. Team restructuring proposals\n\nKey Decisions:\n- Approved 15% budget increase for R&D\n- Launch date set for March 2025\n- Two new hires approved for engineering team\n\nAction Items:\n- Alice: Prepare detailed budget breakdown by Friday\n- Bob: Draft product requirements document\n- Charlie: Schedule interviews for new positions\n",
    "Project Status Report\n\nProject: Smart File Organizer v2.0\nStatus: On Track\nSprint: 14 of 20\n\nCompleted This Week:\n- Implemented file categorization algorithm\n- Added support for 15+ file extensions\n- Integrated with cloud storage API\n- Fixed 3 critical bugs from QA testing\n\nPlanned Next Week:\n- User acceptance testing begins\n- Performance optimization for large directories\n- Documentation updates\n\nRisks:\n- Third-party API rate limiting may affect sync speed\n- Need additional testing on Windows platform\n",
    "Dear Team,\n\nI hope this message finds you well. I wanted to share some exciting updates about our upcoming product launch.\n\nAfter months of hard work, we are pleased to announce that the Smart File Organizer will be released on March 15, 2025. This tool will revolutionize how users manage their digital files.\n\nKey Features:\n- Automatic file categorization by type\n- Smart duplicate detection\n- Cloud backup integration\n- Cross-platform compatibility\n\nPlease review the attached documentation and provide your feedback by end of week.\n\nBest regards,\nThe Development Team\n",
    "Recipe: Classic Chocolate Chip Cookies\n\nPrep Time: 15 minutes\nCook Time: 12 minutes\nServings: 48 cookies\n\nIngredients:\n- 2 1/4 cups all-purpose flour\n- 1 tsp baking soda\n- 1 tsp salt\n- 1 cup butter, softened\n- 3/4 cup granulated sugar\n- 3/4 cup packed brown sugar\n- 2 large eggs\n- 2 tsp vanilla extract\n- 2 cups chocolate chips\n\nInstructions:\n1. Preheat oven to 375 degrees F\n2. Mix flour, baking soda and salt in a bowl\n3. Beat butter, sugars, eggs and vanilla until creamy\n4. Gradually blend in flour mixture\n5. Stir in chocolate chips\n6. Drop onto ungreased baking sheets\n7. Bake for 9 to 11 minutes or until golden brown\n",
    "Daily Journal Entry\n\nDate: Wednesday, November 20, 2024\nWeather: Partly cloudy, 18 degrees C\nMood: Productive and optimistic\n\nToday was a remarkably productive day. I managed to complete the file organization module that I have been working on for the past week. The algorithm now correctly identifies and sorts files into their respective categories.\n\nI also had a great meeting with the team where we discussed the roadmap for the next quarter. Everyone seems excited about the new features we are planning to implement.\n\nIn the evening, I went for a run in the park. The autumn leaves are beautiful this time of year. It is amazing how a bit of exercise can clear your mind and boost creativity.\n\nTomorrow, I plan to start working on the user interface improvements and write some unit tests for the sorting algorithm.\n\nGratitude list:\n- Supportive team members\n- Good health\n- Beautiful weather for running\n"
};
#define NUM_TEMPLATES 5

/* ---- PICK RANDOM ASSET FROM DIRECTORY BY EXTENSION ---- */
static int pick_random_asset(const char *dir, const char *ext[], int num_exts,
                             char *out_path, size_t out_sz) {
    DIR *dp = opendir(dir);
    if (!dp) return -1;
    char candidates[64][MAX_PATH];
    int count = 0;
    struct dirent *e;
    while ((e = readdir(dp)) != NULL && count < 64) {
        if (e->d_name[0] == '.') continue;
        const char *dot = strrchr(e->d_name, '.');
        if (!dot) continue;
        for (int i=0; i<num_exts; i++) {
            if (strcasecmp(dot, ext[i]) == 0) {
                snprintf(candidates[count], MAX_PATH, "%s/%s", dir, e->d_name);
                count++;
                break;
            }
        }
    }
    closedir(dp);
    if (count == 0) return -1;
    int idx = rand() % count;
    strncpy(out_path, candidates[idx], out_sz - 1);
    out_path[out_sz - 1] = '\0';
    return 0;
}

/* ---- BINARY COPY ---- */
static int copy_binary_file(const char *src, const char *dst) {
    FILE *in = fopen(src, "rb");
    if (!in) return -1;
    FILE *out = fopen(dst, "wb");
    if (!out) { fclose(in); return -1; }
    char buf[8192];
    size_t n;
    while ((n = fread(buf, 1, sizeof(buf), in)) > 0) {
        fwrite(buf, 1, n, out);
    }
    fclose(in);
    fclose(out);
    return 0;
}

/* ---- FILL AN EMPTY FILE WITH CONTENT ---- */
static void fill_with_demo_content(const char *file_path, const char *ext,
                                    const char *assets_path) {
    /* Only fill if file is empty (0 bytes) */
    struct stat st;
    if (stat(file_path, &st) != 0 || st.st_size > 0) return;
    if (!ext || !assets_path || assets_path[0] == '\0') return;

    int success = 0;

    if (strcmp(ext, ".txt") == 0) {
        char asset_dir[MAX_PATH], src[MAX_PATH];
        snprintf(asset_dir, sizeof(asset_dir), "%s/documents", assets_path);
        const char *exts[] = { ".txt" };
        if (pick_random_asset(asset_dir, exts, 1, src, sizeof(src)) == 0) {
            success = (copy_binary_file(src, file_path) == 0);
            if (success) {
                add_op("copyFile", "Fill txt with demo content",
                       "open(2)/read(2)/write(2)/close(2)", src, file_path, 1, NULL);
            }
        }
        if (!success) {
            FILE *fp = fopen(file_path, "w");
            if (fp) {
                fputs(text_templates[rand() % NUM_TEMPLATES], fp);
                fclose(fp);
                add_op("writeFile", "Fill file with demo text",
                       "open(2)/write(2)/close(2)", file_path, NULL, 1, NULL);
            }
        }
    }
    else if (strcmp(ext, ".pdf") == 0) {
        char asset_dir[MAX_PATH], src[MAX_PATH];
        snprintf(asset_dir, sizeof(asset_dir), "%s/documents", assets_path);
        const char *exts[] = { ".pdf" };
        if (pick_random_asset(asset_dir, exts, 1, src, sizeof(src)) == 0) {
            if (copy_binary_file(src, file_path) == 0) {
                add_op("copyFile", "Fill pdf with demo content",
                       "open(2)/read(2)/write(2)/close(2)", src, file_path, 1, NULL);
            }
        }
    }
    else if (is_img(ext)) {
        char asset_dir[MAX_PATH], src[MAX_PATH];
        snprintf(asset_dir, sizeof(asset_dir), "%s/images", assets_path);
        const char *exts[] = { ".jpg", ".jpeg", ".png" };
        if (pick_random_asset(asset_dir, exts, 3, src, sizeof(src)) == 0) {
            if (copy_binary_file(src, file_path) == 0) {
                add_op("copyFile", "Fill image with demo content",
                       "open(2)/read(2)/write(2)/close(2)", src, file_path, 1, NULL);
            }
        }
    }
    else if (is_aud(ext)) {
        char asset_dir[MAX_PATH], src[MAX_PATH];
        snprintf(asset_dir, sizeof(asset_dir), "%s/audio", assets_path);
        const char *exts[] = { ".mp3" };
        if (pick_random_asset(asset_dir, exts, 1, src, sizeof(src)) == 0) {
            if (copy_binary_file(src, file_path) == 0) {
                add_op("copyFile", "Fill audio with demo content",
                       "open(2)/read(2)/write(2)/close(2)", src, file_path, 1, NULL);
            }
        }
    }
    else if (is_vid(ext)) {
        char asset_dir[MAX_PATH], src[MAX_PATH];
        snprintf(asset_dir, sizeof(asset_dir), "%s/videos", assets_path);
        const char *exts[] = { ".mp4" };
        if (pick_random_asset(asset_dir, exts, 1, src, sizeof(src)) == 0) {
            if (copy_binary_file(src, file_path) == 0) {
                add_op("copyFile", "Fill video with demo content",
                       "open(2)/read(2)/write(2)/close(2)", src, file_path, 1, NULL);
            }
        }
    }
}

static int organize_directory(const char *base_path, const char *assets_path) {
    DIR *dp = opendir(base_path);
    if (!dp) {
        add_op("readdir", "Read directory entries", "opendir(3)/readdir(3)", base_path, NULL, 0, strerror(errno));
        printf("{\"operations\":[],\"result\":null,\"error\":\"%s\"}\n", strerror(errno));
        return -1;
    }
    add_op("readdir", "Read directory entries", "opendir(3)/readdir(3)", base_path, NULL, 1, NULL);

    char documents[MAX_PATH], images[MAX_PATH], audio[MAX_PATH], videos[MAX_PATH], others[MAX_PATH];
    snprintf(documents, sizeof(documents), "%s/Documents", base_path);
    snprintf(images, sizeof(images), "%s/Images", base_path);
    snprintf(audio, sizeof(audio), "%s/Audio", base_path);
    snprintf(videos, sizeof(videos), "%s/Videos", base_path);
    snprintf(others, sizeof(others), "%s/Others", base_path);

    mkdir(documents, 0777);
    mkdir(images, 0777);
    mkdir(audio, 0777);
    mkdir(videos, 0777);
    mkdir(others, 0777);
    add_op("mkdir", "Create category folder", "mkdir(2)", documents, NULL, 1, NULL);
    add_op("mkdir", "Create category folder", "mkdir(2)", images, NULL, 1, NULL);
    add_op("mkdir", "Create category folder", "mkdir(2)", audio, NULL, 1, NULL);
    add_op("mkdir", "Create category folder", "mkdir(2)", videos, NULL, 1, NULL);
    add_op("mkdir", "Create category folder", "mkdir(2)", others, NULL, 1, NULL);

    char *docs[64], *imgs[64], *auds[64], *vids[64], *oth[64];
    int d = 0, i = 0, a = 0, v = 0, o = 0;
    struct dirent *entry;
    while ((entry = readdir(dp)) != NULL) {
        if (strcmp(entry->d_name, ".") == 0 || strcmp(entry->d_name, "..") == 0) continue;
        char ent_path[MAX_PATH];
        snprintf(ent_path, sizeof(ent_path), "%s/%s", base_path, entry->d_name);
        struct stat st;
        if (stat(ent_path, &st) == 0 && S_ISDIR(st.st_mode)) continue;

        char old_path[MAX_PATH], new_path[MAX_PATH];
        snprintf(old_path, sizeof(old_path), "%s/%s", base_path, entry->d_name);
        const char *ext = strrchr(entry->d_name, '.');
        char *dest = others;
        char **list = oth;
        int *cnt = &o;
        if (ext && is_doc(ext)) { dest = documents; list = docs; cnt = &d; }
        else if (ext && is_img(ext)) { dest = images; list = imgs; cnt = &i; }
        else if (ext && is_aud(ext)) { dest = audio; list = auds; cnt = &a; }
        else if (ext && is_vid(ext)) { dest = videos; list = vids; cnt = &v; }
        snprintf(new_path, sizeof(new_path), "%s/%s", dest, entry->d_name);

        if (rename(old_path, new_path) == 0) {
            add_op("rename", "Move file to category", "rename(2)", old_path, new_path, 1, NULL);
            /* Fill the moved file with demo content if it is empty */
            if (ext) fill_with_demo_content(new_path, ext, assets_path);
            list[*cnt] = strdup(entry->d_name);
            (*cnt)++;
        } else {
            add_op("rename", "Move file to category", "rename(2)", old_path, new_path, 0, strerror(errno));
        }
    }
    closedir(dp);

    printf("{\"operations\":[");
    for (int k = 0; k < nops; k++) {
        OpRec *r = &ops[k];
        char pe[MAX_PATH * 2], p2e[MAX_PATH * 2], ee[256];
        json_escape(r->path, pe, sizeof(pe));
        json_escape(r->path2, p2e, sizeof(p2e));
        json_escape(r->error, ee, sizeof(ee));
        if (k) printf(",");
        printf("{\"id\":%d,\"op\":\"%s\",\"description\":\"%s\",\"syscall\":\"%s\",\"path\":\"%s\",\"path2\":\"%s\",\"success\":%s,\"error\":\"%s\"}",
               r->id, r->op, r->description, r->syscall, pe, p2e, r->success ? "true" : "false", ee);
    }
    printf("],\"result\":{");
    printf("\"Documents\":[");
    for (int x = 0; x < d; x++) printf("%s\"%s\"", x ? "," : "", docs[x]);
    printf("],\"Images\":[");
    for (int x = 0; x < i; x++) printf("%s\"%s\"", x ? "," : "", imgs[x]);
    printf("],\"Audio\":[");
    for (int x = 0; x < a; x++) printf("%s\"%s\"", x ? "," : "", auds[x]);
    printf("],\"Videos\":[");
    for (int x = 0; x < v; x++) printf("%s\"%s\"", x ? "," : "", vids[x]);
    printf("],\"Others\":[");
    for (int x = 0; x < o; x++) printf("%s\"%s\"", x ? "," : "", oth[x]);
    printf("]}}\n");

    for (int x = 0; x < d; x++) free(docs[x]);
    for (int x = 0; x < i; x++) free(imgs[x]);
    for (int x = 0; x < a; x++) free(auds[x]);
    for (int x = 0; x < v; x++) free(vids[x]);
    for (int x = 0; x < o; x++) free(oth[x]);
    return 0;
}

int main(int argc, char *argv[]) {
    nops = 0;
    srand((unsigned)time(NULL));

    if (argc < 3) {
        fprintf(stderr, "Usage: organizer_cli create-dir <workspace> <dirName> <file1> [file2 ...]\n");
        fprintf(stderr, "       organizer_cli organize <workspace> [subpath] [assets_path]\n");
        return 1;
    }
    const char *mode = argv[1];
    const char *workspace = argv[2];

    if (strcmp(mode, "create-dir") == 0) {
        if (argc < 5) {
            fprintf(stderr, "create-dir needs: workspace dirName file1 [file2 ...]\n");
            return 1;
        }
        return create_dir_and_files(workspace, argv[3], &argv[4], argc - 4) == 0 ? 0 : 1;
    }
    if (strcmp(mode, "organize") == 0) {
        char base[MAX_PATH];
        if (argc >= 4 && argv[3][0])
            snprintf(base, sizeof(base), "%s/%s", workspace, argv[3]);
        else
            snprintf(base, sizeof(base), "%s", workspace);

        /* Optional 4th arg: path to assets directory for demo content */
        const char *assets_path = (argc >= 5) ? argv[4] : NULL;
        return organize_directory(base, assets_path) == 0 ? 0 : 1;
    }
    fprintf(stderr, "Unknown mode: %s\n", mode);
    return 1;
}
