# CSS Troubleshooting Guide - Initiative Tracker

## Quick Checks

### 1. Hard Refresh Browser Cache
The most common issue! The browser may be caching the old CSS.

**Mac:**
- Chrome/Edge: `Cmd + Shift + R`
- Firefox: `Cmd + Shift + R`
- Safari: `Cmd + Option + R`

**Windows/Linux:**
- Chrome/Edge: `Ctrl + Shift + R` or `Ctrl + F5`
- Firefox: `Ctrl + Shift + R` or `Ctrl + F5`

### 2. Check CSS File is Loading

**Open DevTools (F12 or right-click → Inspect)**

1. Go to **Network** tab
2. Refresh the page
3. Filter by "CSS"
4. Look for `initiative-tracker.css`
5. Click on it and check if it shows the new bubble styles

**What to look for:**
- File should be ~18KB (new version)
- Should contain `.initiative-card {` with `border-radius: 20px`
- If it's showing old styles, cache issue!

### 3. Check for CSS Syntax Errors

**In DevTools Console tab:**
- Look for any CSS parsing errors (red text)
- Errors like "Invalid property value" or "Unexpected token"

### 4. Check CSS Specificity Conflicts

**In DevTools Elements tab:**
1. Click on an initiative card
2. Look at the **Styles** panel on the right
3. Find `.initiative-card` styles
4. Check if any styles are ~~crossed out~~ (overridden)

**What this means:**
- If you see `border-radius: 20px` with a strikethrough, something else is overriding it
- Look for more specific selectors winning the cascade

## Advanced Debugging

### Check Which CSS File is Actually Loaded

**Run this in Console (F12 → Console tab):**

```javascript
// Check if new CSS is loaded
const stylesheets = Array.from(document.styleSheets);
const initiativeCSS = stylesheets.find(sheet =>
  sheet.href && sheet.href.includes('initiative-tracker')
);

if (initiativeCSS) {
  const rules = Array.from(initiativeCSS.cssRules || []);
  const cardRule = rules.find(rule =>
    rule.selectorText && rule.selectorText.includes('.initiative-card')
  );

  if (cardRule) {
    console.log('✅ Found .initiative-card rule:');
    console.log('Border radius:', cardRule.style.borderRadius);
    console.log('Padding:', cardRule.style.padding);
  } else {
    console.log('❌ No .initiative-card rule found');
  }
} else {
  console.log('❌ initiative-tracker.css not found');
}
```

**Expected output:**
```
✅ Found .initiative-card rule:
Border radius: 20px
Padding: 1.5rem
```

### Check Computed Styles

**In DevTools Elements tab:**
1. Select an initiative card element
2. Go to **Computed** tab (next to Styles)
3. Search for specific properties:
   - `border-radius` → should be `20px`
   - `padding` → should be `24px` (1.5rem)
   - `box-shadow` → should show multiple shadows

### Force CSS Reload Without Cache

**Run in Console:**
```javascript
// Force reload CSS
const link = document.querySelector('link[href*="initiative-tracker"]');
if (link) {
  const href = link.href;
  link.href = href + '?v=' + Date.now();
  console.log('🔄 Forced CSS reload');
} else {
  console.log('❌ CSS link not found');
}
```

## Common Issues & Fixes

### Issue 1: CSS Not Updating
**Symptom:** Cards still look cramped, small borders
**Fix:**
1. Hard refresh (Cmd+Shift+R)
2. Clear browser cache completely:
   - Chrome: Settings → Privacy → Clear browsing data → Cached images and files
3. Restart dev server:
   ```bash
   # Stop server (Ctrl+C)
   npm run dev
   ```

### Issue 2: Some Styles Apply, Others Don't
**Symptom:** Border-radius works but padding doesn't
**Fix:** CSS specificity conflict
1. Open DevTools → Elements
2. Find the element
3. Look for competing selectors
4. Add `!important` temporarily to test:
   ```css
   .initiative-card {
     padding: 1.5rem !important;
   }
   ```

### Issue 3: Wrong CSS File Loading
**Symptom:** DevTools shows old file size (13KB)
**Fix:**
1. Check file actually replaced:
   ```bash
   ls -lh src/styles/initiative-tracker.css
   ```
   Should show ~18KB
2. Check no duplicate imports in `main.css`
3. Restart Vite dev server

### Issue 4: CSS Variables Not Defined
**Symptom:** Colors/spacing look broken
**Fix:** Check design tokens loaded:
```javascript
// In Console
const root = getComputedStyle(document.documentElement);
console.log('Primary color:', root.getPropertyValue('--color-primary'));
console.log('Surface:', root.getPropertyValue('--surface-secondary'));
```

## Manual CSS Injection (Emergency Fix)

If nothing works, inject styles directly to test:

**In Console:**
```javascript
const style = document.createElement('style');
style.textContent = `
  .initiative-card {
    border-radius: 20px !important;
    padding: 1.5rem !important;
    border: 3px solid var(--border-primary) !important;
    box-shadow:
      0 4px 12px rgba(0, 0, 0, 0.08),
      0 2px 4px rgba(0, 0, 0, 0.06) !important;
  }

  .initiative-number-input {
    width: 70px !important;
    height: 70px !important;
    font-size: 1.75rem !important;
    border-radius: 12px !important;
  }
`;
document.head.appendChild(style);
console.log('🎨 Injected emergency CSS');
```

If this makes it look better, it confirms the CSS file isn't loading properly.

## Check File Permissions

**Sometimes the CSS file has wrong permissions:**
```bash
ls -la src/styles/initiative-tracker.css
```

**If it shows weird permissions, fix them:**
```bash
chmod 644 src/styles/initiative-tracker.css
```

## Nuclear Option: Clear Everything

```bash
# Stop dev server (Ctrl+C)

# Clear all caches
rm -rf node_modules/.vite
rm -rf dist

# Restart
npm run dev
```

Then hard refresh browser (Cmd+Shift+R).

## What to Report

If still not working, check these and report:

1. **Browser & Version:**
   ```javascript
   navigator.userAgent
   ```

2. **CSS File Size:**
   ```bash
   ls -lh src/styles/initiative-tracker.css
   ```

3. **Loaded CSS Content:**
   ```javascript
   fetch('/src/styles/initiative-tracker.css')
     .then(r => r.text())
     .then(css => console.log(css.substring(0, 500)))
   ```

4. **Applied Styles:**
   ```javascript
   const card = document.querySelector('.initiative-card');
   if (card) {
     const styles = getComputedStyle(card);
     console.log({
       borderRadius: styles.borderRadius,
       padding: styles.padding,
       border: styles.border
     });
   }
   ```

5. **Screenshot of DevTools Styles panel** showing the `.initiative-card` styles

## Quick Visual Test

**Paste this in Console to add a test indicator:**
```javascript
document.querySelectorAll('.initiative-card').forEach((card, i) => {
  card.style.outline = '3px solid red';
  card.title = `Card ${i} - If you see red outline, CSS is partially working`;
});
```
