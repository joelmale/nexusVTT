# D&D Style Border Components for React

A comprehensive library of decorative SVG border components perfect for D&D character sheets, fantasy RPG interfaces, and game UIs.

## 📦 Installation

```bash
# Copy these files to your project:
- BorderElements.tsx     # Core SVG library
- BorderPanel.tsx        # Main components
- BorderPanel.css        # Styles
- BorderUtils.tsx        # Utilities & themes
- CharacterSheetExample.tsx  # Example usage
```

## 🚀 Quick Start

### Basic Usage

```tsx
import { BorderPanel } from './BorderPanel';
import './BorderPanel.css';

function App() {
  return (
    <BorderPanel variant="ornate" padding="20px">
      <h2>Your Content Here</h2>
      <p>This panel has ornate fantasy borders!</p>
    </BorderPanel>
  );
}
```

### Stat Block Example

```tsx
import { StatBlock } from './BorderPanel';

<StatBlock 
  label="STR" 
  value={16} 
  modifier="+3" 
  size="medium" 
/>
```

### Shield Block (for AC)

```tsx
import { ShieldBlock } from './BorderPanel';

<ShieldBlock value={18} label="ARMOR CLASS" />
```

## 🎨 Available Components

### 1. **BorderPanel** - The Main Component

The core component that can be customized with different styles.

```tsx
<BorderPanel
  variant="ornate"           // Preset style
  cornerStyle="shield"       // Override corner style
  edgeStyle="double"         // Override edge style
  color="#2c2416"            // Border color
  backgroundColor="rgba(245, 245, 220, 0.1)"
  width={300}
  height={200}
  padding="20px"
  showOrnament={true}        // Add decorative ornament
  ornamentPosition="top"
  ornamentStyle="flourish"
>
  {children}
</BorderPanel>
```

### 2. **Specialized Components**

#### StatBlock
Perfect for ability scores and stats:
```tsx
<StatBlock 
  label="DEX" 
  value={14} 
  modifier="+2" 
  size="small|medium|large" 
/>
```

#### TitledPanel
Panel with a title banner:
```tsx
<TitledPanel title="INVENTORY" variant="simple">
  {/* Your content */}
</TitledPanel>
```

#### ScrollPanel
Scroll-styled panel for notes:
```tsx
<ScrollPanel width={300} height={200}>
  <p>Character backstory...</p>
</ScrollPanel>
```

## 🎭 Variants & Styles

### Frame Presets
- `ornate` - Decorative corners with flourishes
- `shield` - Military/knight theme
- `simple` - Clean cut corners
- `rounded` - Soft curved corners
- `decorative` - Extra ornamental details

### Corner Styles
- `ornate` - Fancy curved corners with circles
- `cut` - Sharp diagonal cuts
- `shield` - Shield-shaped corners
- `rounded` - Simple rounded corners

### Edge Styles
- `straight` - Simple line
- `double` - Double line
- `decorative` - Line with dot pattern

### Ornament Styles
- `diamond` - Diamond shape
- `flourish` - Decorative swirl
- `star` - Star shape
- `dots` - Three dots
- `celtic` - Celtic knot

## 🎨 Theming

### Using the Theme Hook

```tsx
import { useBorderTheme, BorderThemeProvider } from './BorderUtils';

function ThemedApp() {
  const { theme, applyTheme, customize } = useBorderTheme({
    initialTheme: 'medieval'
  });

  return (
    <BorderPanel
      color={theme.color}
      backgroundColor={theme.backgroundColor}
      cornerStyle={theme.cornerStyle}
      edgeStyle={theme.edgeStyle}
    >
      {/* Content */}
    </BorderPanel>
  );
}
```

### Available Themes

- `medieval` - Classic D&D style
- `elven` - Green, nature-inspired
- `dwarven` - Stone and metal
- `arcane` - Magical purple glow
- `demonic` - Red with fiery glow
- `celestial` - Golden divine light
- `minimal` - Clean and simple
- `tech` - Futuristic cyan

### Theme Provider

```tsx
import { BorderThemeProvider, ThemeSelector } from './BorderUtils';

<BorderThemeProvider initialTheme="medieval">
  <ThemeSelector />  {/* Dropdown to change themes */}
  <YourApp />
</BorderThemeProvider>
```

## 🎯 Complete Character Sheet Example

```tsx
import React from 'react';
import { BorderPanel, StatBlock, ShieldBlock, TitledPanel } from './BorderPanel';

function CharacterSheet() {
  const stats = {
    strength: 16,
    dexterity: 14,
    constitution: 15,
    intelligence: 12,
    wisdom: 13,
    charisma: 10
  };

  return (
    <div style={{ padding: '20px', backgroundColor: '#f5f5dc' }}>
      {/* Header */}
      <TitledPanel title="CHARACTER INFO" variant="decorative">
        <h2>Thorin Ironforge</h2>
        <p>Level 5 Dwarf Fighter</p>
      </TitledPanel>

      {/* Stats */}
      <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
        {Object.entries(stats).map(([stat, value]) => (
          <StatBlock
            key={stat}
            label={stat.substring(0, 3).toUpperCase()}
            value={value}
            modifier={`+${Math.floor((value - 10) / 2)}`}
            size="small"
          />
        ))}
      </div>

      {/* Combat Stats */}
      <div style={{ display: 'flex', gap: '20px', marginTop: '20px' }}>
        <ShieldBlock value={18} />
        
        <BorderPanel variant="simple" width={100} height={120}>
          <div style={{ textAlign: 'center' }}>
            <div>INITIATIVE</div>
            <div style={{ fontSize: '2rem' }}>+2</div>
          </div>
        </BorderPanel>

        <BorderPanel variant="simple" width={100} height={120}>
          <div style={{ textAlign: 'center' }}>
            <div>SPEED</div>
            <div style={{ fontSize: '2rem' }}>25</div>
            <div>feet</div>
          </div>
        </BorderPanel>
      </div>

      {/* Hit Points */}
      <BorderPanel 
        variant="ornate" 
        showOrnament={true}
        ornamentStyle="diamond"
        style={{ marginTop: '20px' }}
      >
        <h3>Hit Points</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
          <div>Max: 45</div>
          <div>Current: 38</div>
          <div>Temp: 0</div>
        </div>
      </BorderPanel>
    </div>
  );
}
```

## 🛠 Customization

### Custom Colors

```tsx
<BorderPanel 
  color="#8B0000"                     // Dark red borders
  backgroundColor="rgba(139, 0, 0, 0.1)"  // Light red background
  className="border-panel--glow"      // Add glow effect
>
  {content}
</BorderPanel>
```

### CSS Classes for Effects

- `border-panel--glow` - Adds a glow effect
- `border-panel--shadow` - Adds drop shadow
- `border-panel--no-bg` - Removes background
- `border-panel--thick` - Thicker borders
- `border-panel--thin` - Thinner borders

### Creating Custom Themes

```tsx
import { BorderThemes } from './BorderUtils';

// Add your custom theme
BorderThemes.myCustomTheme = {
  name: 'My Theme',
  cornerStyle: 'ornate',
  edgeStyle: 'double',
  color: '#yourColor',
  backgroundColor: 'rgba(r, g, b, a)',
  strokeWidth: 2,
  cornerSize: 50,
  edgeWidth: 10,
  glow: '0 0 20px rgba(r, g, b, a)'
};
```

## 📱 Responsive Design

The components automatically adjust for mobile screens:
- Corner sizes reduce by 30%
- Edge widths scale down
- Use the `responsive` option in `useBorderTheme`

```tsx
const { theme } = useBorderTheme({
  initialTheme: 'medieval',
  responsive: true  // Enable responsive adjustments
});
```

## 🎮 Integration with Your Game

### With Redux/Context

```tsx
// Store theme in your global state
const characterTheme = useSelector(state => state.character.theme);

<BorderPanel 
  variant={characterTheme}
  // Map character class to theme
  color={getClassColor(character.class)}
>
  {/* Character content */}
</BorderPanel>
```

### Dynamic Theming Based on Class

```tsx
const getThemeByClass = (characterClass: string) => {
  const classThemes = {
    'Wizard': 'arcane',
    'Paladin': 'celestial',
    'Warlock': 'demonic',
    'Ranger': 'elven',
    'Fighter': 'dwarven',
    'Rogue': 'minimal'
  };
  return classThemes[characterClass] || 'medieval';
};

<BorderPanel variant={getThemeByClass(character.class)}>
  {/* Content */}
</BorderPanel>
```

## 🎯 Pro Tips

1. **Mix and Match**: Combine different corner and edge styles:
   ```tsx
   <BorderPanel cornerStyle="shield" edgeStyle="decorative">
   ```

2. **Layer Effects**: Use multiple panels for depth:
   ```tsx
   <BorderPanel variant="ornate" className="border-panel--shadow">
     <BorderPanel variant="simple" padding="10px">
       {/* Nested content */}
     </BorderPanel>
   </BorderPanel>
   ```

3. **Conditional Styling**: Change borders based on state:
   ```tsx
   <BorderPanel 
     color={character.hp < 10 ? '#8B0000' : '#2c2416'}
     className={character.hp < 10 ? 'border-panel--glow' : ''}
   >
   ```

4. **Performance**: Use CSS classes instead of inline styles for frequently changing properties

## 🐛 Troubleshooting

### Borders not showing?
- Make sure to import `BorderPanel.css`
- Check that SVG `currentColor` is inheriting properly
- Verify minimum width/height is larger than corner size

### Overlapping corners?
- Increase panel width/height
- Reduce `cornerSize` in theme
- Use smaller corner variants

### Performance issues?
- Use `React.memo` for static panels
- Avoid recreating theme objects on every render
- Consider using CSS transforms instead of re-rendering

## 📄 License

Feel free to use these components in your D&D/RPG projects!

---

Made with ⚔️ for the tabletop gaming community