#!/bin/bash

# Simple script to run the frontend
# This starts a local HTTP server to serve the frontend files

echo "🚀 Starting File Organizer Frontend..."
echo ""
echo "The frontend will be available at:"
echo "  http://localhost:8000/frontend/index.html"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

# Check if Python 3 is available
if command -v python3 &> /dev/null; then
    python3 -m http.server 8000
elif command -v python &> /dev/null; then
    python -m SimpleHTTPServer 8000
else
    echo "Error: Python is not installed. Please install Python to run the frontend."
    echo ""
    echo "Alternatively, you can use:"
    echo "  - Node.js: npx http-server -p 8000"
    echo "  - PHP: php -S localhost:8000"
    exit 1
fi
