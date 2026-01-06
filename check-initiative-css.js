/**
 * Initiative Tracker CSS Diagnostic Tool
 *
 * Paste this into your browser's DevTools Console (F12)
 * to diagnose CSS loading issues
 */

console.log('🔍 Initiative Tracker CSS Diagnostic Tool\n');
console.log('=========================================\n');

// 1. Check if CSS file exists and is loaded
const stylesheets = Array.from(document.styleSheets);
const initiativeCSS = stylesheets.find(sheet =>
  sheet.href && sheet.href.includes('initiative-tracker')
);

console.log('1️⃣ CSS FILE LOADED:');
if (initiativeCSS) {
  console.log('✅ initiative-tracker.css is loaded');
  console.log('   URL:', initiativeCSS.href);
} else {
  console.log('❌ initiative-tracker.css NOT FOUND');
  console.log('   Available stylesheets:', stylesheets.map(s => s.href).filter(Boolean));
}

// 2. Check for .initiative-card rule
console.log('\n2️⃣ CHECKING CSS RULES:');
if (initiativeCSS) {
  try {
    const rules = Array.from(initiativeCSS.cssRules || []);
    const cardRule = rules.find(rule =>
      rule.selectorText && rule.selectorText === '.initiative-card'
    );

    if (cardRule) {
      console.log('✅ Found .initiative-card rule');
      console.log('   Border radius:', cardRule.style.borderRadius || 'NOT SET');
      console.log('   Padding:', cardRule.style.padding || 'NOT SET');
      console.log('   Border:', cardRule.style.border || 'NOT SET');

      // Check if bubble style
      if (cardRule.style.borderRadius === '20px') {
        console.log('   ✅ BUBBLE STYLE DETECTED!');
      } else {
        console.log('   ⚠️  Old style - border-radius should be 20px');
      }
    } else {
      console.log('❌ .initiative-card rule not found in stylesheet');
    }
  } catch (e) {
    console.log('⚠️  Cannot read CSS rules (CORS or security):', e.message);
  }
}

// 3. Check actual DOM elements
console.log('\n3️⃣ CHECKING DOM ELEMENTS:');
const cards = document.querySelectorAll('.initiative-card');
console.log(`Found ${cards.length} initiative card(s)`);

if (cards.length > 0) {
  const firstCard = cards[0];
  const computed = getComputedStyle(firstCard);

  console.log('✅ Inspecting first card:');
  console.log('   Border radius:', computed.borderRadius);
  console.log('   Padding:', computed.padding);
  console.log('   Border:', computed.border);
  console.log('   Box shadow:', computed.boxShadow);
  console.log('   Background:', computed.backgroundColor);

  // Highlight for visual check
  firstCard.style.outline = '3px solid lime';
  console.log('   🎯 Added green outline to first card for visibility');

  // Check if bubble style is applied
  const hasBubbleStyle = computed.borderRadius.includes('20px');
  if (hasBubbleStyle) {
    console.log('   ✅ BUBBLE STYLE IS APPLIED!');
  } else {
    console.log('   ❌ BUBBLE STYLE NOT APPLIED');
    console.log('   Expected: 20px border-radius');
    console.log('   Got:', computed.borderRadius);
  }
} else {
  console.log('⚠️  No .initiative-card elements found in DOM');
  console.log('   Is the initiative tracker open?');
}

// 4. Check CSS variables
console.log('\n4️⃣ CHECKING CSS VARIABLES:');
const root = getComputedStyle(document.documentElement);
const variables = {
  '--color-primary': root.getPropertyValue('--color-primary'),
  '--surface-secondary': root.getPropertyValue('--surface-secondary'),
  '--border-primary': root.getPropertyValue('--border-primary'),
  '--text-primary': root.getPropertyValue('--text-primary'),
};

for (const [name, value] of Object.entries(variables)) {
  if (value.trim()) {
    console.log(`✅ ${name}: ${value.trim()}`);
  } else {
    console.log(`❌ ${name}: NOT DEFINED`);
  }
}

// 5. Check for competing styles
console.log('\n5️⃣ CHECKING FOR STYLE CONFLICTS:');
if (cards.length > 0) {
  const firstCard = cards[0];
  const allRules = [];

  // Get all stylesheets
  for (const sheet of document.styleSheets) {
    try {
      for (const rule of sheet.cssRules || []) {
        if (rule.selectorText && rule.selectorText.includes('initiative-card')) {
          allRules.push({
            selector: rule.selectorText,
            sheet: sheet.href ? new URL(sheet.href).pathname : 'inline',
          });
        }
      }
    } catch (e) {
      // CORS restriction, skip
    }
  }

  console.log(`Found ${allRules.length} CSS rule(s) matching 'initiative-card':`);
  allRules.forEach(rule => {
    console.log(`   - ${rule.selector} from ${rule.sheet}`);
  });
}

// 6. Final recommendation
console.log('\n6️⃣ RECOMMENDATION:');
if (cards.length === 0) {
  console.log('⚠️  Open the Initiative Tracker panel first!');
  console.log('   Click the ⏱ Initiative icon in the sidebar');
} else {
  const firstCard = cards[0];
  const computed = getComputedStyle(firstCard);
  const hasBubbleStyle = computed.borderRadius.includes('20px');

  if (hasBubbleStyle) {
    console.log('✅ Everything looks good! CSS is applied correctly.');
  } else {
    console.log('❌ CSS is not fully applied. Try:');
    console.log('   1. Hard refresh: Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows)');
    console.log('   2. Clear browser cache');
    console.log('   3. Restart dev server (Ctrl+C then npm run dev)');
    console.log('   4. Check the file size:');
    console.log('      ls -lh src/styles/initiative-tracker.css');
    console.log('      Should be ~18KB');
  }
}

console.log('\n=========================================');
console.log('Diagnostic complete! 🎉\n');

// Return summary object
const summary = {
  cssLoaded: !!initiativeCSS,
  cardsFound: cards.length,
  bubbleStyleApplied: cards.length > 0 && getComputedStyle(cards[0]).borderRadius.includes('20px'),
  variablesDefined: Object.values(variables).every(v => v.trim()),
};

console.log('Summary:', summary);

if (!summary.bubbleStyleApplied && cards.length > 0) {
  console.log('\n💡 Quick fix: Run this to force apply styles:');
  console.log('   Copy and paste the code from CSS_TROUBLESHOOTING.md "Manual CSS Injection" section');
}

summary;
