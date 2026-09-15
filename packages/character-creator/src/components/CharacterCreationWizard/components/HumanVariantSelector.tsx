import React from 'react';
import { CharacterCreationData, AbilityName, SkillName } from '../../../types/dnd';

interface HumanVariantSelectorProps {
  data: CharacterCreationData;
  updateData: (updates: Partial<CharacterCreationData>) => void;
}

export const HumanVariantSelector: React.FC<HumanVariantSelectorProps> = ({
  data,
  updateData
}) => {
  const handleVariantChange = (variantSlug: string) => {
    updateData({ selectedSpeciesVariant: variantSlug });

    // Reset variant-specific data when changing variants
    if (variantSlug === 'standard') {
      updateData({
        variantAbilityBonuses: undefined,
        variantSkillProficiency: undefined,
        variantFeat: undefined
      });
    }
  };

  const handleAbilityToggle = (ability: AbilityName) => {
    const current = data.variantAbilityBonuses || ({} as Record<AbilityName, number>);
    const newBonuses = { ...current };

    if (newBonuses[ability]) {
      // Remove the bonus
      delete newBonuses[ability];
    } else {
      // Add the bonus (only if we have less than 2)
      const currentCount = Object.values(newBonuses).reduce((sum: number, val: number) => sum + val, 0);
      if (currentCount < 2) {
        newBonuses[ability] = 1;
      }
    }

    updateData({ variantAbilityBonuses: Object.keys(newBonuses).length > 0 ? newBonuses : undefined });
  };

  const abilities = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'];
  const selectedAbilities = data.variantAbilityBonuses ? Object.keys(data.variantAbilityBonuses) : [];
  const totalBonuses = data.variantAbilityBonuses ? Object.values(data.variantAbilityBonuses).reduce((sum, val) => sum + val, 0) : 0;

  return (
    <div className="mt-6 p-4 bg-theme-tertiary rounded-lg">
      <h4 className="text-lg font-bold text-theme-primary mb-4">Choose Human Variant</h4>

      {/* Variant Selection */}
      <div className="space-y-3 mb-6">
        <label className="flex items-start gap-3 p-3 border border-theme-primary/20 rounded cursor-pointer hover:bg-theme-quaternary">
          <input
            type="radio"
            name="humanVariant"
            value="standard"
            checked={data.selectedSpeciesVariant === 'standard'}
            onChange={(e) => handleVariantChange(e.target.value)}
            className="mt-1"
          />
          <div className="flex-1">
            <div className="font-semibold text-theme-primary">Standard Human</div>
            <div className="text-sm text-theme-muted mb-2">
              The classic human from the Basic Rules - +1 to all ability scores for broad versatility.
            </div>
            <div className="text-xs text-theme-disabled">
              STR +1, DEX +1, CON +1, INT +1, WIS +1, CHA +1
            </div>
          </div>
        </label>

        <label className="flex items-start gap-3 p-3 border border-accent-orange rounded cursor-pointer hover:bg-orange-50">
          <input
            type="radio"
            name="humanVariant"
            value="variant"
            checked={data.selectedSpeciesVariant === 'variant'}
            onChange={(e) => handleVariantChange(e.target.value)}
            className="mt-1"
          />
          <div className="flex-1">
            <div className="font-semibold text-accent-orange">Variant Human ⭐</div>
            <div className="text-sm text-theme-muted mb-2">
              The specialist human - +1 to two abilities, one skill proficiency, and one feat for focused power.
            </div>
            <div className="text-xs text-theme-disabled">
              Custom ability selection + Skill proficiency + Feat
            </div>
          </div>
        </label>
      </div>

      {/* Variant Human Options */}
      {data.selectedSpeciesVariant === 'variant' && (
        <div className="space-y-4 p-4 bg-orange-50 rounded-lg border border-accent-orange/20">
          <h5 className="font-semibold text-accent-orange">Variant Human Selections</h5>

          {/* Ability Score Selection */}
          <div>
            <div className="text-sm font-medium text-theme-primary mb-2">
              Ability Score Increases (+1 to two abilities):
              <span className="text-xs text-theme-muted ml-2">
                Selected: {selectedAbilities.join(', ') || 'None'} ({totalBonuses}/2)
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {abilities.map(ability => (
                <button
                  key={ability}
                  onClick={() => handleAbilityToggle(ability as AbilityName)}
                  className={`p-2 text-sm font-medium rounded transition-colors ${
                    data.variantAbilityBonuses?.[ability as AbilityName]
                      ? 'bg-accent-orange text-white'
                      : totalBonuses >= 2 && !data.variantAbilityBonuses?.[ability as AbilityName]
                      ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                      : 'bg-theme-secondary hover:bg-theme-tertiary text-theme-primary'
                  }`}
                  disabled={totalBonuses >= 2 && !data.variantAbilityBonuses?.[ability as AbilityName]}
                >
                  {ability}
                </button>
              ))}
            </div>
          </div>

          {/* Skill Proficiency Selection */}
          <div>
            <div className="text-sm font-medium text-theme-primary mb-2">
              Skill Proficiency:
            </div>
            <select
              value={data.variantSkillProficiency || ''}
              onChange={(e) => updateData({ variantSkillProficiency: e.target.value as SkillName })}
              className="w-full p-2 border border-theme-primary/20 rounded bg-theme-secondary text-theme-primary"
            >
              <option value="">Choose a skill...</option>
              {/* Add skill options here */}
              <option value="Athletics">Athletics (STR)</option>
              <option value="Acrobatics">Acrobatics (DEX)</option>
              <option value="Sleight of Hand">Sleight of Hand (DEX)</option>
              <option value="Stealth">Stealth (DEX)</option>
              <option value="Arcana">Arcana (INT)</option>
              <option value="History">History (INT)</option>
              <option value="Investigation">Investigation (INT)</option>
              <option value="Nature">Nature (INT)</option>
              <option value="Religion">Religion (INT)</option>
              <option value="Animal Handling">Animal Handling (WIS)</option>
              <option value="Insight">Insight (WIS)</option>
              <option value="Medicine">Medicine (WIS)</option>
              <option value="Perception">Perception (WIS)</option>
              <option value="Survival">Survival (WIS)</option>
              <option value="Deception">Deception (CHA)</option>
              <option value="Intimidation">Intimidation (CHA)</option>
              <option value="Performance">Performance (CHA)</option>
              <option value="Persuasion">Persuasion (CHA)</option>
            </select>
          </div>

          {/* Feat Selection */}
          <div>
            <div className="text-sm font-medium text-theme-primary mb-2">
              Feat:
            </div>
            <select
              value={data.variantFeat || ''}
              onChange={(e) => updateData({ variantFeat: e.target.value })}
              className="w-full p-2 border border-theme-primary/20 rounded bg-theme-secondary text-theme-primary"
            >
              <option value="">Choose a feat...</option>
              {/* Add feat options here - simplified for now */}
              <option value="Alert">Alert - +5 initiative, can't be surprised, hidden creatures don't get advantage</option>
              <option value="Lucky">Lucky - 3 luck points for rerolls</option>
              <option value="Resilient">Resilient (CON) - Proficiency in CON saves, +1 CON</option>
              <option value="Skilled">Skilled - Proficiency in one skill + Expertise in one skill</option>
              <option value="War Caster">War Caster - Advantage on concentration, can cast as opportunity attack, etc.</option>
              <option value="Elemental Adept">Elemental Adept (Fire) - Ignore fire resistance, spells ignore fire immunity</option>
              <option value="Spell Sniper">Spell Sniper - Double range on attack spells, ignore half cover</option>
            </select>
          </div>
        </div>
      )}
    </div>
  );
};