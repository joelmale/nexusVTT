import React from 'react';
import { 
  BorderPanel, 
  StatBlock, 
  ShieldBlock, 
  TitledPanel,
  ScrollPanel 
} from './BorderPanel';
import './BorderPanel.css';

// ============================================
// EXAMPLE CHARACTER SHEET IMPLEMENTATION
// ============================================

interface CharacterSheetProps {
  character?: {
    name: string;
    class: string;
    level: number;
    species: string;
    background: string;
    stats: {
      strength: number;
      dexterity: number;
      constitution: number;
      intelligence: number;
      wisdom: number;
      charisma: number;
    };
    ac: number;
    hp: {
      current: number;
      max: number;
      temp: number;
    };
    speed: number;
    initiative: number;
    proficiencyBonus: number;
  };
}

const ExampleCharacterSheet: React.FC<CharacterSheetProps> = ({ 
  character = {
    name: 'Thorin Ironforge',
    class: 'Fighter',
    level: 5,
    species: 'Dwarf',
    background: 'Soldier',
    stats: {
      strength: 18,
      dexterity: 12,
      constitution: 16,
      intelligence: 10,
      wisdom: 13,
      charisma: 8
    },
    ac: 18,
    hp: {
      current: 42,
      max: 55,
      temp: 0
    },
    speed: 25,
    initiative: 1,
    proficiencyBonus: 3
  }
}) => {
  // Calculate modifiers
  const getModifier = (stat: number) => {
    const mod = Math.floor((stat - 10) / 2);
    return mod >= 0 ? `+${mod}` : `${mod}`;
  };

  return (
    <div style={{ 
      padding: '20px', 
      backgroundColor: '#f5f5dc',
      minHeight: '100vh'
    }}>
      {/* Header Section */}
      <TitledPanel 
        title="CHARACTER INFO" 
        variant="decorative"
        width="100%"
        className="mb-4"
      >
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '20px',
          padding: '10px'
        }}>
          <div>
            <label style={{ fontSize: '0.875rem', color: '#666' }}>CHARACTER NAME</label>
            <div style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>{character.name}</div>
          </div>
          <div>
            <label style={{ fontSize: '0.875rem', color: '#666' }}>CLASS & LEVEL</label>
            <div style={{ fontSize: '1.125rem' }}>{character.class} {character.level}</div>
          </div>
          <div>
            <label style={{ fontSize: '0.875rem', color: '#666' }}>SPECIES</label>
            <div style={{ fontSize: '1.125rem' }}>{character.species}</div>
          </div>
          <div>
            <label style={{ fontSize: '0.875rem', color: '#666' }}>BACKGROUND</label>
            <div style={{ fontSize: '1.125rem' }}>{character.background}</div>
          </div>
        </div>
      </TitledPanel>

      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: '150px 1fr', 
        gap: '20px',
        marginTop: '20px'
      }}>
        {/* Left Column - Stats & Combat */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Ability Scores */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {Object.entries(character.stats).map(([stat, value]) => (
              <StatBlock
                key={stat}
                label={stat.substring(0, 3).toUpperCase()}
                value={value}
                modifier={getModifier(value)}
                size="small"
              />
            ))}
          </div>
        </div>

        {/* Middle Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Combat Stats Row */}
          <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
            <ShieldBlock value={character.ac} size={100} />
            
            <BorderPanel 
              variant="simple" 
              width={100} 
              height={120}
              padding="10px"
            >
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>INITIATIVE</div>
                <div style={{ fontSize: '2rem', fontWeight: 'bold', marginTop: '10px' }}>
                  {character.initiative >= 0 ? '+' : ''}{character.initiative}
                </div>
              </div>
            </BorderPanel>

            <BorderPanel 
              variant="simple" 
              width={100} 
              height={120}
              padding="10px"
            >
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>SPEED</div>
                <div style={{ fontSize: '2rem', fontWeight: 'bold', marginTop: '10px' }}>
                  {character.speed}
                </div>
                <div style={{ fontSize: '0.75rem', marginTop: '5px' }}>feet</div>
              </div>
            </BorderPanel>
          </div>

          {/* Hit Points Section */}
          <BorderPanel 
            variant="ornate" 
            width="100%"
            showOrnament={true}
            ornamentPosition="top"
            ornamentStyle="diamond"
          >
            <div>
              <div style={{ 
                textAlign: 'center', 
                marginBottom: '15px',
                fontSize: '0.875rem',
                fontWeight: 'bold',
                textTransform: 'uppercase'
              }}>
                Hit Points
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                <div style={{ 
                  padding: '10px', 
                  border: '1px solid #2c2416',
                  borderRadius: '4px',
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: '0.75rem', color: '#666' }}>Maximum</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{character.hp.max}</div>
                </div>
                
                <div style={{ 
                  padding: '10px', 
                  border: '2px solid #2c2416',
                  borderRadius: '4px',
                  textAlign: 'center',
                  backgroundColor: 'rgba(255, 0, 0, 0.05)'
                }}>
                  <div style={{ fontSize: '0.75rem', color: '#666' }}>Current</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{character.hp.current}</div>
                </div>
                
                <div style={{ 
                  padding: '10px', 
                  border: '1px dashed #2c2416',
                  borderRadius: '4px',
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: '0.75rem', color: '#666' }}>Temporary</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{character.hp.temp}</div>
                </div>
              </div>
            </div>
          </BorderPanel>

          {/* Skills Section */}
          <TitledPanel title="SKILLS" variant="simple">
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '8px',
              fontSize: '0.875rem'
            }}>
              {[
                'Acrobatics (Dex)', 'Animal Handling (Wis)',
                'Arcana (Int)', 'Athletics (Str)',
                'Deception (Cha)', 'History (Int)',
                'Insight (Wis)', 'Intimidation (Cha)',
                'Investigation (Int)', 'Medicine (Wis)',
                'Nature (Int)', 'Perception (Wis)',
                'Performance (Cha)', 'Persuasion (Cha)',
                'Religion (Int)', 'Sleight of Hand (Dex)',
                'Stealth (Dex)', 'Survival (Wis)'
              ].map(skill => (
                <label key={skill} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input type="checkbox" />
                  <span>{skill}</span>
                </label>
              ))}
            </div>
          </TitledPanel>

          {/* Notes Section */}
          <ScrollPanel width="100%" height={200}>
            <h4 style={{ marginTop: 0 }}>Character Notes</h4>
            <p style={{ fontSize: '0.875rem', lineHeight: 1.6 }}>
              Thorin Ironforge, veteran of the Battle of Red Mountain, seeks to restore honor 
              to his clan's name. Armed with his ancestral warhammer "Grudgebearer" and clad 
              in dwarven plate mail, he ventures forth to right ancient wrongs.
            </p>
            <p style={{ fontSize: '0.875rem', lineHeight: 1.6 }}>
              <strong>Personality Trait:</strong> I face problems head-on. A simple, direct solution 
              is the best path to success.
            </p>
            <p style={{ fontSize: '0.875rem', lineHeight: 1.6 }}>
              <strong>Ideal:</strong> Honor. My word is my bond.
            </p>
            <p style={{ fontSize: '0.875rem', lineHeight: 1.6 }}>
              <strong>Bond:</strong> I will restore my clan's lost honor.
            </p>
            <p style={{ fontSize: '0.875rem', lineHeight: 1.6 }}>
              <strong>Flaw:</strong> I remember every insult I've received and nurse a silent 
              resentment toward anyone who's ever wronged me.
            </p>
          </ScrollPanel>
        </div>
      </div>
    </div>
  );
};

// ============================================
// USAGE EXAMPLES
// ============================================

export const UsageExamples: React.FC = () => {
  return (
    <div style={{ padding: '40px', backgroundColor: '#fafafa' }}>
      <h1>Border Component Examples</h1>
      
      {/* Example 1: Different Variants */}
      <section style={{ marginBottom: '40px' }}>
        <h2>Panel Variants</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
          <BorderPanel variant="ornate" padding="20px">
            <h3>Ornate Style</h3>
            <p>Decorative corners with flourishes</p>
          </BorderPanel>
          
          <BorderPanel variant="shield" padding="20px">
            <h3>Shield Style</h3>
            <p>Military-inspired design</p>
          </BorderPanel>
          
          <BorderPanel variant="simple" padding="20px">
            <h3>Simple Style</h3>
            <p>Clean cut corners</p>
          </BorderPanel>
          
          <BorderPanel variant="rounded" padding="20px">
            <h3>Rounded Style</h3>
            <p>Soft curved corners</p>
          </BorderPanel>
        </div>
      </section>

      {/* Example 2: Stat Blocks */}
      <section style={{ marginBottom: '40px' }}>
        <h2>Stat Blocks</h2>
        <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
          <StatBlock label="STR" value={16} modifier="+3" size="small" />
          <StatBlock label="DEX" value={14} modifier="+2" size="medium" />
          <StatBlock label="CON" value={18} modifier="+4" size="large" />
        </div>
      </section>

      {/* Example 3: Special Components */}
      <section style={{ marginBottom: '40px' }}>
        <h2>Special Components</h2>
        <div style={{ display: 'flex', gap: '40px', flexWrap: 'wrap', alignItems: 'center' }}>
          <ShieldBlock value={19} />
          
          <TitledPanel title="INVENTORY" variant="simple" width={300}>
            <ul style={{ margin: 0, paddingLeft: '20px' }}>
              <li>Longsword +1</li>
              <li>Healing Potion (2)</li>
              <li>Rope (50ft)</li>
              <li>Torch (5)</li>
            </ul>
          </TitledPanel>
          
          <ScrollPanel width={300} height={150}>
            <h4 style={{ marginTop: 0 }}>Quest Log</h4>
            <p style={{ fontSize: '0.875rem' }}>
              • Clear the goblin cave<br/>
              • Speak to the village elder<br/>
              • Find the missing merchant<br/>
              • Investigate the ancient ruins
            </p>
          </ScrollPanel>
        </div>
      </section>

      {/* Example 4: Custom Colors */}
      <section style={{ marginBottom: '40px' }}>
        <h2>Custom Colors & Effects</h2>
        <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
          <BorderPanel 
            variant="ornate" 
            color="#8B0000"
            backgroundColor="rgba(139, 0, 0, 0.1)"
            padding="20px"
            width={200}
          >
            <h3>Blood Red</h3>
          </BorderPanel>
          
          <BorderPanel 
            variant="ornate" 
            color="#4169E1"
            backgroundColor="rgba(65, 105, 225, 0.1)"
            padding="20px"
            width={200}
            className="border-panel--glow"
          >
            <h3>Royal Blue (Glow)</h3>
          </BorderPanel>
          
          <BorderPanel 
            variant="ornate" 
            color="#FFD700"
            backgroundColor="rgba(255, 215, 0, 0.1)"
            padding="20px"
            width={200}
            className="border-panel--shadow"
          >
            <h3>Gold (Shadow)</h3>
          </BorderPanel>
        </div>
      </section>
    </div>
  );
};

export default ExampleCharacterSheet;
