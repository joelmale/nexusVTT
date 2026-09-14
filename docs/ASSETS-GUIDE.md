# 🎨 Nexus VTT - Graphics and Assets Guide

## Where to Put Your Graphics

### 🗂️ **Public Assets** (`apps/vtt/public/`)
Use for files that need direct URL access or don't need processing:

```
apps/vtt/public/
├── assets/
│   ├── icons/          # App icons, favicons, PWA icons
│   │   ├── nexus-icon.svg
│   │   ├── nexus-icon-192.png
│   │   ├── nexus-icon-512.png
│   │   ├── nexus-favicon.ico
│   │   └── nexus-apple-touch-icon.png
│   ├── logos/          # Logos for branding
│   │   ├── nexus-logo.svg
│   │   ├── nexus-logo-light.png
│   │   ├── nexus-logo-dark.png
│   │   └── nexus-wordmark.svg
│   └── images/         # Background images, hero images
│       ├── hero-bg.jpg
│       ├── og-image.png
│       └── screenshots/
└── (root level - legacy support)
    ├── nexus-icon.svg
    ├── nexus-icon-192.png
    ├── nexus-icon-512.png
    └── manifest.json
```

### 🗂️ **Source Assets** (`apps/vtt/src/assets/`)
Use for assets that will be processed by Vite:

```
apps/vtt/src/
└── assets/
    ├── icons/          # SVG icons for components
    │   ├── dice/
    │   ├── ui/
    │   └── game/
    ├── images/         # Component images
    └── logos/          # Logo variants for components
```

## 📋 **Recommended File Structure for Your Nexus Assets**

### **Icons** (Place in `apps/vtt/public/assets/icons/`)
- **nexus-icon.svg** - Vector version (scalable)
- **nexus-icon-16.png** - Favicon (16x16)
- **nexus-icon-32.png** - Favicon (32x32) 
- **nexus-icon-192.png** - PWA icon (192x192)
- **nexus-icon-512.png** - PWA icon (512x512)
- **nexus-apple-touch-icon.png** - iOS icon (180x180)
- **nexus-favicon.ico** - Multi-size ICO file

### **Logos** (Place in `apps/vtt/public/assets/logos/`)
- **nexus-logo.svg** - Main vector logo
- **nexus-logo-light.png** - For dark backgrounds
- **nexus-logo-dark.png** - For light backgrounds  
- **nexus-wordmark.svg** - Text-only version
- **nexus-symbol.svg** - Icon-only version

### **Images** (Place in `apps/vtt/public/assets/images/`)
- **hero-background.jpg** - Main background image
- **og-image.png** - Social media sharing (1200x630)
- **screenshot.png** - App preview image

## 🔄 **After Adding Your Assets**

### 1. **Update the HTML** (`index.html`)
```html
<link rel="icon" type="image/svg+xml" href="/assets/icons/nexus-icon.svg" />
<link rel="apple-touch-icon" href="/assets/icons/nexus-apple-touch-icon.png" />
<meta property="og:image" content="/assets/images/og-image.png" />
```

### 2. **Update the Manifest** (`apps/vtt/public/manifest.json`)
```json
{
  "icons": [
    {
      "src": "/assets/icons/nexus-icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/assets/icons/nexus-icon-512.png", 
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}
```

### 3. **Update Components** (if using logos in React)
```tsx
// For components, you can import from apps/vtt/src/assets
import nexusLogo from '@/assets/logos/nexus-logo.svg';

// Or reference public assets directly
<img src="/assets/logos/nexus-logo.svg" alt="Nexus VTT" />
```

## 🎯 **Quick Setup for Your Files**

1. **Place your generated files here:**
   - Main logo → `apps/vtt/public/assets/logos/nexus-logo.svg`
   - App icon → `apps/vtt/public/assets/icons/nexus-icon.svg`
   - PNG icons → `apps/vtt/public/assets/icons/nexus-icon-{size}.png`

2. **Update references in:**
   - `index.html` 
   - `apps/vtt/public/manifest.json`
   - Components that use logos

3. **Remove old files:**
   - `apps/vtt/public/nexus-icon.svg` (replace with your new one)

## 📏 **Recommended Sizes**

### **App Icons**
- **16x16, 32x32** - Favicon
- **180x180** - Apple touch icon  
- **192x192, 512x512** - PWA icons

### **Logos**
- **Vector (SVG)** - Scalable for all uses
- **High-res PNG** - For cases where SVG isn't supported

### **Background Images**  
- **1920x1080** - Hero backgrounds
- **1200x630** - Social media (Open Graph)

Would you like me to help you update the manifest and HTML files once you've placed your assets?
