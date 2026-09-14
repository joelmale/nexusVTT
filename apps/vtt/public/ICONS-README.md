# Nexus Icon Files

The following icon files are referenced in the manifest but need to be created:

## Required Icons

### nexus-icon-192.png
- Size: 192x192 pixels
- Format: PNG
- Purpose: PWA icon for mobile devices

### nexus-icon-512.png  
- Size: 512x512 pixels
- Format: PNG
- Purpose: PWA icon for high-resolution displays

### nexus-og-image.png
- Size: 1200x630 pixels (recommended for social media)
- Format: PNG
- Purpose: Open Graph image for social media sharing

## Creating the Icons

You can create these icons by:

1. Using the existing SVG icon (/nexus-icon.svg) as a base
2. Converting to PNG at the required sizes
3. Tools like:
   - Adobe Illustrator/Photoshop
   - GIMP (free)
   - Online converters like cloudconvert.com
   - SVG to PNG command line tools

## Temporary Fix

For now, you can copy the SVG file to the PNG names to prevent console errors:
```bash
cp public/nexus-icon.svg public/nexus-icon-192.png
cp public/nexus-icon.svg public/nexus-icon-512.png
```

The app will work without these icons, but you'll get console warnings until they're properly created.
