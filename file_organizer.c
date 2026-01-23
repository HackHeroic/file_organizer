#include <stdio.h>      // printf, scanf, FILE
#include <dirent.h>    // DIR, struct dirent, opendir, readdir
#include <string.h>    // strcmp, strcpy, strrchr
#include <sys/stat.h>  // mkdir
#include <stdlib.h>    // exit, NULL

// ---------- FUNCTION PROTOTYPES ----------
void create_directory_and_files();
void organize_directory(char directoryPath[]);

// ---------- OPTION 1: CREATE DIRECTORY AND FILES ----------
void create_directory_and_files() {
    char dirName[256];
    char fileName[256];
    char filePath[300];

    printf("Enter new directory name: ");
    scanf("%255s", dirName);

    if (mkdir(dirName, 0777) == 0) {
        printf("Directory '%s' created successfully.\n", dirName);
    } else {
        printf("Directory already exists or cannot be created.\n");
    }

    for (int i = 1; i <= 5; i++) {
        printf("Enter name for file %d: ", i);
        scanf("%255s", fileName);

        sprintf(filePath, "%s/%s", dirName, fileName);
        FILE *fp = fopen(filePath, "w");

        if (fp != NULL) {
            fclose(fp);
            printf("File '%s' created.\n", fileName);
        } else {
            printf("Error creating file '%s'.\n", fileName);
        }
    }
}

// ---------- OPTION 2: ORGANIZE DIRECTORY + GENERATE JSON ----------
void organize_directory(char directoryPath[]) {
    struct dirent *entry;
    DIR *dp = opendir(directoryPath);

    if (dp == NULL) {
        printf("Error: Cannot open directory.\n");
        return;
    }

    // Folder paths
    char documents[300], images[300], audio[300], videos[300], others[300];
    sprintf(documents, "%s/Documents", directoryPath);
    sprintf(images, "%s/Images", directoryPath);
    sprintf(audio, "%s/Audio", directoryPath);
    sprintf(videos, "%s/Videos", directoryPath);
    sprintf(others, "%s/Others", directoryPath);

    mkdir(documents, 0777);
    mkdir(images, 0777);
    mkdir(audio, 0777);
    mkdir(videos, 0777);
    mkdir(others, 0777);

    // Arrays to store file names for JSON
    char docs[50][256], imgs[50][256], auds[50][256], vids[50][256], oth[50][256];
    int d = 0, i = 0, a = 0, v = 0, o = 0;

    while ((entry = readdir(dp)) != NULL) {

        if (strcmp(entry->d_name, ".") == 0 ||
            strcmp(entry->d_name, "..") == 0)
            continue;

        if (entry->d_type == DT_DIR)
            continue;

        char oldPath[300], newPath[300];
        char *ext = strrchr(entry->d_name, '.');

        sprintf(oldPath, "%s/%s", directoryPath, entry->d_name);

        // Documents
        if (ext &&
            (strcmp(ext, ".txt") == 0 ||
             strcmp(ext, ".pdf") == 0 ||
             strcmp(ext, ".docx") == 0)) {

            sprintf(newPath, "%s/%s", documents, entry->d_name);
            rename(oldPath, newPath);
            strcpy(docs[d++], entry->d_name);
        }
        // Images
        else if (ext &&
                (strcmp(ext, ".jpg") == 0 ||
                 strcmp(ext, ".jpeg") == 0 ||
                 strcmp(ext, ".png") == 0)) {

            sprintf(newPath, "%s/%s", images, entry->d_name);
            rename(oldPath, newPath);
            strcpy(imgs[i++], entry->d_name);
        }
        // Audio
        else if (ext &&
                (strcmp(ext, ".mp3") == 0 ||
                 strcmp(ext, ".wav") == 0 ||
                 strcmp(ext, ".aac") == 0)) {

            sprintf(newPath, "%s/%s", audio, entry->d_name);
            rename(oldPath, newPath);
            strcpy(auds[a++], entry->d_name);
        }
        // Videos
        else if (ext &&
                (strcmp(ext, ".mp4") == 0 ||
                 strcmp(ext, ".mkv") == 0 ||
                 strcmp(ext, ".avi") == 0)) {

            sprintf(newPath, "%s/%s", videos, entry->d_name);
            rename(oldPath, newPath);
            strcpy(vids[v++], entry->d_name);
        }
        // Others
        else {
            sprintf(newPath, "%s/%s", others, entry->d_name);
            rename(oldPath, newPath);
            strcpy(oth[o++], entry->d_name);
        }
    }

    closedir(dp);

    // Write valid JSON output
    FILE *json = fopen("output.json", "w");
    fprintf(json, "{\n");

    fprintf(json, "  \"Documents\": [");
    for (int x = 0; x < d; x++)
        fprintf(json, "\"%s\"%s", docs[x], (x < d - 1) ? ", " : "");
    fprintf(json, "],\n");

    fprintf(json, "  \"Images\": [");
    for (int x = 0; x < i; x++)
        fprintf(json, "\"%s\"%s", imgs[x], (x < i - 1) ? ", " : "");
    fprintf(json, "],\n");

    fprintf(json, "  \"Audio\": [");
    for (int x = 0; x < a; x++)
        fprintf(json, "\"%s\"%s", auds[x], (x < a - 1) ? ", " : "");
    fprintf(json, "],\n");

    fprintf(json, "  \"Videos\": [");
    for (int x = 0; x < v; x++)
        fprintf(json, "\"%s\"%s", vids[x], (x < v - 1) ? ", " : "");
    fprintf(json, "],\n");

    fprintf(json, "  \"Others\": [");
    for (int x = 0; x < o; x++)
        fprintf(json, "\"%s\"%s", oth[x], (x < o - 1) ? ", " : "");
    fprintf(json, "]\n");

    fprintf(json, "}\n");
    fclose(json);

    printf("Files organized successfully.\n");
    printf("JSON output generated: output.json\n");
}

// ---------- MAIN FUNCTION ----------
int main() {
    int choice;
    char directoryPath[256];

    while (1) {
        printf("\n===== FILE ORGANIZER MENU =====\n");
        printf("1. Create a new directory and add files\n");
        printf("2. Organize an existing directory\n");
        printf("3. Exit\n");
        printf("Enter your choice: ");
        scanf("%d", &choice);

        switch (choice) {
            case 1:
                create_directory_and_files();
                break;

            case 2:
                printf("Enter the directory path to organize: ");
                scanf("%255s", directoryPath);
                organize_directory(directoryPath);
                break;

            case 3:
                printf("Exiting program.\n");
                exit(0);

            default:
                printf("Invalid choice. Try again.\n");
        }
    }

    return 0;
}
