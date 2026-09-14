#!/bin/bash

# NexusCodex Documentation Runner
# This script helps run the Docusaurus documentation site

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
DOCS_DIR="$PROJECT_ROOT/docs"

cd "$DOCS_DIR"

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "Installing documentation dependencies..."
    npm install
fi

echo "Starting NexusCodex documentation server on http://localhost:3003"
echo "Press Ctrl+C to stop"
echo ""

npm start -- --port 3003