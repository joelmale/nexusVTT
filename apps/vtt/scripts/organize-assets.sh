#!/bin/bash

echo "🎨 Nexus VTT - Asset Organization Helper"
echo "======================================"
echo ""

# Function to check if file exists and move it
organize_asset() {
    local source="$1"
    local dest="$2"
    local desc="$3"
    
    if [ -f "$source" ]; then
        mkdir -p "$(dirname "$dest")"
        cp "$source" "$dest"
        echo "✅ Moved $desc: $source → $dest"
    else
        echo "📝 Place $desc at: $dest"
    fi
}

echo "Current asset structure:"
echo ""

# Check for common asset file names you might have
organize_asset "nexus-logo.svg" "public/assets/logos/nexus-logo.svg" "Main Logo"
organize_asset "nexus-icon.svg" "public/assets/icons/nexus-icon.svg" "App Icon" 
organize_asset "nexus-logo.png" "public/assets/logos/nexus-logo.png" "Logo PNG"
organize_asset "nexus-icon.png" "public/assets/icons/nexus-icon.png" "Icon PNG"

# Check for different size variants
for size in 16 32 192 512; do
    organize_asset "nexus-icon-${size}.png" "public/assets/icons/nexus-icon-${size}.png" "Icon ${size}x${size}"
done

echo ""
echo "📁 Asset directories created:"
echo "   • /public/assets/icons/     - App icons, favicons"
echo "   • /public/assets/logos/     - Logos and branding"  
echo "   • /public/assets/images/    - Background images"
echo "   • /src/assets/              - Component assets"
echo ""

echo "🚀 Next steps:"
echo "1. Place your generated Nexus logo and icon files in the appropriate directories"
echo "2. Run: npm run update-assets (after placing files)"
echo "3. Update references in components if needed"
echo ""

echo "💡 Tip: You can drag and drop files directly into VS Code's file explorer!"
