# Tool Descriptions System

This directory contains enhanced tool descriptions for D&D 5e character sheets, including artisan's tools, gaming sets, musical instruments, and specialist tools.

## Files

- **`toolDescriptions.json`** - Complete database of tool descriptions with gameplay information
- **`/src/types/tools.ts`** - TypeScript type definitions
- **`/src/services/toolService.ts`** - Service functions to access tool data
- **`/src/services/toolService.test.ts`** - Test suite (32 tests, all passing)

## Data Structure

Each tool has the following properties:

```typescript
{
  name: string;              // Display name
  category: ToolCategory;    // Tool category
  commonUses: string;        // Brief summary
  typicalAbilities: string[]; // Abilities used with this tool
  uses: string[];            // Specific use cases
  specialUse: string;        // Unique application
  engineTags: string[];      // Tags for rules engine
}
```

## Categories

1. **Artisan's Tools** (17 tools)
   - Alchemist's Supplies, Brewer's Supplies, Calligrapher's Supplies, Carpenter's Tools, Cartographer's Tools, Cobbler's Tools, Cook's Utensils, Glassblower's Tools, Jeweler's Tools, Leatherworker's Tools, Mason's Tools, Painter's Supplies, Potter's Tools, Smith's Tools, Tinker's Tools, Weaver's Tools, Woodcarver's Tools

2. **Gaming Sets** (4 tools)
   - Dice Set, Dragonchess Set, Playing Card Set, Three-Dragon Ante Set

3. **Musical Instruments** (10 instruments)
   - Bagpipes, Drum, Dulcimer, Flute, Horn, Lute, Lyre, Pan Flute, Shawm, Viol

4. **Specialist Tools** (6 tools)
   - Disguise Kit, Forgery Kit, Herbalism Kit, Navigator's Tools, Poisoner's Kit, Thieves' Tools

## Usage Examples

### Get a Tool Description

```typescript
import { getToolDescription } from '@/services/toolService';

const alchemist = getToolDescription('alchemist-supplies');
console.log(alchemist?.name);         // "Alchemist's Supplies"
console.log(alchemist?.commonUses);   // "Chemicals, mixtures, reactions"
console.log(alchemist?.specialUse);   // "You can attempt to analyze magical potions..."
```

### Display Tool Card in UI

```typescript
import { getToolCard } from '@/services/toolService';

const card = getToolCard('thieves-tools');

// In your component:
<div className="tool-card">
  <h3>{card.name}</h3>
  <p className="category">{card.category}</p>
  <p className="common-uses">{card.commonUses}</p>
  <p className="abilities">Typical Abilities: {card.abilities}</p>

  <h4>Uses:</h4>
  <ul>
    {card.uses.map((use, i) => <li key={i}>{use}</li>)}
  </ul>

  <p className="special-use">{card.specialUse}</p>

  <div className="tags">
    {card.tags.map(tag => <span key={tag} className="tag">{tag}</span>)}
  </div>
</div>
```

### Search Tools by Tag

```typescript
import { getToolsByTag } from '@/services/toolService';

// Get all crafting tools
const craftingTools = getToolsByTag('crafting');

// Get all social tools
const socialTools = getToolsByTag('social');

// Get all navigation tools
const navigationTools = getToolsByTag('navigation');
```

### Get Tools by Ability

```typescript
import { getToolsUsingAbility } from '@/services/toolService';

// Get all Dexterity-based tools
const dexTools = getToolsUsingAbility('Dexterity');

// Get all Intelligence-based tools
const intTools = getToolsUsingAbility('Intelligence');

// Get all Charisma-based tools (musical instruments, etc.)
const chaTools = getToolsUsingAbility('Charisma');
```

### Check Tool Proficiency with Ability

```typescript
import { toolUsesAbility, getPrimaryAbility } from '@/services/toolService';

// Check if a tool uses a specific ability
if (toolUsesAbility('alchemist-supplies', 'Intelligence')) {
  // Apply Intelligence modifier to the check
}

// Get the primary ability for a tool
const ability = getPrimaryAbility('smith-tools'); // 'Strength'
```

## Engine Tags

Tools are tagged for integration with the rules engine:

- **crafting** - Can create items
- **chemical** - Involves chemicals or alchemy
- **analysis** - Used to analyze or identify things
- **food** - Related to food preparation
- **social** - Used in social interactions
- **knowledge** - Provides information or lore
- **forgery** - Can create fake documents/items
- **construction** - Builds structures
- **environment** - Interacts with terrain/structures
- **navigation** - Helps with travel/orientation
- **exploration** - Aids in exploring
- **travel** - Facilitates movement
- **maintenance** - Repairs items
- **survival** - Helps in wilderness
- **support** - Provides buffs/benefits
- **precision** - Requires fine detail work
- **valuation** - Appraises value
- **equipment** - Creates/repairs gear
- **mechanical** - Works with mechanisms
- **problem-solving** - Overcomes obstacles
- **art** - Creates artistic works
- **communication** - Conveys messages
- **storage** - Creates containers
- **performance** - Used in performances
- **insight** - Reads people/situations
- **deception** - Facilitates trickery
- **healing** - Provides medical aid
- **nature** - Interacts with plants/wildlife
- **stealth** - Aids in hiding/sneaking

## Integration with Character Creation

### Background Tool Proficiencies

When a character selects a background, they gain tool proficiencies. Use this system to display what those tools do:

```typescript
import { getToolDescription } from '@/services/toolService';

// Character selects Acolyte background
const background = backgrounds.find(b => b.slug === 'acolyte-2024');
const toolProf = background.tool_proficiencies[0]; // "Calligrapher's Supplies"

// Show what this tool does
const toolInfo = getToolDescription('calligrapher-supplies');

// Display in UI
<div className="tool-proficiency">
  <h4>{toolInfo?.name}</h4>
  <p>{toolInfo?.commonUses}</p>
  <p>Uses: {toolInfo?.uses.join(', ')}</p>
  <p className="special">{toolInfo?.specialUse}</p>
</div>
```

### Ability Check Modifiers

When a player makes a tool check, use the typical abilities to determine the modifier:

```typescript
import { getPrimaryAbility } from '@/services/toolService';

function makeToolCheck(toolSlug: string, character: Character) {
  const ability = getPrimaryAbility(toolSlug);

  if (!ability) return null;

  // Get ability modifier from character
  const abilityScore = character.abilityScores[ability.toUpperCase()];
  const modifier = Math.floor((abilityScore - 10) / 2);

  // Add proficiency bonus if proficient
  const isProficient = character.proficiencies.tools.includes(toolSlug);
  const profBonus = isProficient ? character.proficiencyBonus : 0;

  // Roll d20 + modifier + proficiency
  const roll = Math.floor(Math.random() * 20) + 1;
  return roll + modifier + profBonus;
}
```

## Example: Tool Selection UI

```typescript
import { getToolsByCategory } from '@/services/toolService';

function ToolSelector({ onSelect }: { onSelect: (tool: string) => void }) {
  const artisanTools = getToolsByCategory('artisans-tools');

  return (
    <div className="tool-selector">
      <h3>Choose an Artisan's Tool</h3>
      <div className="tool-grid">
        {artisanTools.map(tool => (
          <button
            key={tool.name}
            onClick={() => onSelect(tool.name)}
            className="tool-card"
          >
            <h4>{tool.name}</h4>
            <p className="uses">{tool.commonUses}</p>
            <p className="abilities">
              {tool.typicalAbilities.join(' or ')}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}
```

## Testing

Run the test suite:

```bash
npm test -- src/services/toolService.test.ts
```

All 32 tests should pass:
- ✅ Data structure validation
- ✅ Tool retrieval by slug
- ✅ Category filtering
- ✅ Tag-based search
- ✅ Ability-based filtering
- ✅ Search functionality
- ✅ Data integrity checks

## Future Enhancements

Potential additions to this system:

1. **DC Suggestions** - Add typical DCs for common tasks
2. **Time Requirements** - How long each use takes
3. **Material Costs** - Resources needed for crafting
4. **Synergies** - Tools that work well together
5. **Skill Interactions** - Which skills complement each tool
6. **Class Features** - How class features enhance tool use
7. **Example Tasks** - Concrete examples for DMs
8. **Edition Differences** - 2014 vs 2024 rule variations

## Contributing

When adding new tools:

1. Add to the appropriate category in `toolDescriptions.json`
2. Include all required fields
3. Use proper engine tags
4. Add test cases in `toolService.test.ts`
5. Update this README if adding new categories or tags
