# Makefile for File Organizer Project

CC = gcc
CFLAGS = -Wall -Wextra -std=c99
TARGET = organizer
CLI_TARGET = organizer_cli
SOURCE = file_organizer.c
CLI_SOURCE = organizer_cli.c

# Default target: build both menu app and CLI (for Next.js)
all: $(TARGET) $(CLI_TARGET)

# Build the menu-driven organizer
$(TARGET): $(SOURCE)
	$(CC) $(CFLAGS) -o $(TARGET) $(SOURCE)
	@echo "✅ Build successful! Run './$(TARGET)' to start."

# Build the CLI used by Next.js API (outputs JSON)
$(CLI_TARGET): $(CLI_SOURCE)
	$(CC) $(CFLAGS) -o $(CLI_TARGET) $(CLI_SOURCE)
	@echo "✅ CLI built. Next.js can call ./organizer_cli."

# Clean build artifacts
clean:
	rm -f $(TARGET) $(CLI_TARGET)
	rm -f output.json
	@echo "✅ Cleaned build artifacts."

# Run the program
run: $(TARGET)
	./$(TARGET)

# Install (just creates the executable)
install: $(TARGET)

# Help target
help:
	@echo "Available targets:"
	@echo "  make          - Build the organizer executable"
	@echo "  make run      - Build and run the organizer"
	@echo "  make clean    - Remove build artifacts"
	@echo "  make help     - Show this help message"

.PHONY: all clean run install help
