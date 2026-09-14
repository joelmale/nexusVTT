# Default Bundled Assets

This directory contains default base maps and tokens that are bundled with the Nexus VTT application.

## Directory Structure

```
defaults/
├── base_maps/       # Battle maps and scene backgrounds
├── tokens/          # Character and monster tokens
└── manifest.json    # Auto-generated asset metadata
```

## Adding New Assets

### 1. Add Your Files

**Base Maps:**
- Place map images in `base_maps/`
- Supported formats: PNG, JPG, JPEG, WebP
- Naming convention: Include grid size in filename (e.g., "Tavern Interior - 23x16.webp")

**Tokens:**
- Place token images in `tokens/`
- Supported formats: PNG, JPG, JPEG, WebP
- Naming convention: Use descriptive names (e.g., "ElfWizard.png", "GoblinWarrior.png")

### 2. Regenerate Manifest

After adding/removing files, regenerate the manifest:

```bash
npm run generate-default-manifest
```

This script will:
- Scan `base_maps/` and `tokens/` directories
- Extract metadata from filenames
- Auto-categorize assets
- Generate `manifest.json`

### 3. Reload Application

The changes will be available immediately after:
- Restarting the dev server, or
- Refreshing the browser (manifest is loaded on app init)

## Asset Metadata

The manifest generator automatically extracts:

### For Base Maps:
- **Name:** Cleaned filename
- **Grid Size:** Extracted from patterns like "23x16" or "44x32"
- **Tags:** Keywords from filename (lowercase, split by spaces/dashes)
- **Path:** Relative URL path to the image

### For Tokens:
- **Name:** Human-readable name from filename
- **Category:** Auto-detected (pc, npc, monster)
- **Size:** Auto-detected based on keywords (tiny, small, medium, large, huge, gargantuan)
- **Tags:** Keywords extracted from filename

## Best Practices

1. **Keep file sizes reasonable:**
   - Maps: Under 2MB per file
   - Tokens: Under 500KB per file

2. **Use descriptive filenames:**
   - Good: "Haunted Mansion - Night - 44x32.webp"
   - Bad: "map1.jpg"

3. **Include grid dimensions in map filenames:**
   - Pattern: "Name - Details - WIDTHxHEIGHT.ext"
   - Example: "Desert Oasis - Day - 23x16.webp"

4. **Use WebP format when possible:**
   - Better compression
   - Faster loading
   - Convert with: `cwebp input.png -o output.webp`

## Current Assets

Run this command to see current counts:

```bash
node scripts/generate-default-manifest.js
```

Output will show:
- Number of tokens
- Number of maps
- Total assets

## Integration

These assets are automatically available in:

1. **Tokens:** Token Panel → "Default Tokens" library
2. **Base Maps:** Scene Editor → "Browse Base Maps" button

No configuration required - just add files and regenerate the manifest!
