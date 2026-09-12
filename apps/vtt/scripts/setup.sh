#!/bin/bash

echo "🚀 Setting up Nexus VTT..."

# Clean install
echo "📦 Installing dependencies..."
rm -rf node_modules package-lock.json
npm install

# Create temporary icon files to prevent console errors
echo "🎨 Creating temporary icon files..."
cp public/nexus-icon.svg public/nexus-icon-192.png 2>/dev/null || echo "Icon file copy skipped"
cp public/nexus-icon.svg public/nexus-icon-512.png 2>/dev/null || echo "Icon file copy skipped"

echo "✅ Setup complete!"
echo ""
echo "To start development:"
echo "1. Terminal 1: npm run dev"
echo "2. Terminal 2: npm run server:dev"
echo "3. Open http://localhost:5173"
echo ""
echo "The WebSocket server will run on port 5000"
echo "The frontend will run on port 5173"
