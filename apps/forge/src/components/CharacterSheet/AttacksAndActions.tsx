import React from 'react';
import { Character, Equipment } from '../../types/dnd';
import { loadEquipment, COMBAT_ACTIONS } from '../../services/dataService';
import { DiceRoll } from '../../services/diceService';
import { consumeResource, getResourceUses } from '../../utils/resourceUtils';
import { TacticalSection } from './TacticalSection';

type CustomRoll = DiceRoll & {
  description: string;
  damageNotation?: string;
  damageType?: string;
};

// Tactical Action Interface for restructured combat options
interface TacticalAction {
  id: string;
  name: string;
  type: 'weapon-attack' | 'spell-attack' | 'unarmed-attack' | 'special-attack' | 'defensive' | 'movement' | 'support' | 'stealth' | 'healing' | 'action-surge' | 'reaction-setup';
  description: string;
  actionCost: 'Action' | 'Bonus Action' | 'Free' | 'Reaction';
  hasButton: boolean;
  buttonText?: string;
  category: 'offense' | 'defense' | 'mobility' | 'burst';
  isLimited?: boolean;
  usesRemaining?: number;
  maxUses?: number;
  specialUI?: 'bubble-display';
}

interface AttacksAndActionsProps {
  character: Character;
  setRollResult: (result: {
    text: string;
    value: number | null;
    details?: Array<{ value: number; kept: boolean; critical?: 'success' | 'failure' }>
  }) => void;
  onDiceRoll: (roll: CustomRoll) => void;
  onUpdateCharacter: (character: Character) => void;
  layoutMode?: 'paper-sheet' | 'classic-dnd' | 'modern';
}

// Helper function to calculate attack bonus for a weapon
const calculateAttackBonus = (character: Character, weapon: Equipment): number => {
  const isFinesse = weapon.properties?.some(prop => prop.name === 'Finesse');
  const isRanged = weapon.weapon_range === 'Ranged';

  // Determine ability modifier
  let abilityMod = 0;
  if (isRanged || (isFinesse && character.abilities.DEX.modifier > character.abilities.STR.modifier)) {
    abilityMod = character.abilities.DEX.modifier;
  } else {
    abilityMod = character.abilities.STR.modifier;
  }

  // Add proficiency bonus if proficient
  const isProficient = character.proficiencies?.weapons?.some(w =>
    w.toLowerCase().includes(weapon.name.toLowerCase()) ||
    weapon.weapon_category?.toLowerCase() === w.toLowerCase()
  );

  return abilityMod + (isProficient ? character.proficiencyBonus : 0);
};

// Helper function to get weapon damage
const getWeaponDamage = (weapon: Equipment, character: Character): string => {
  if (!weapon.damage) return '0';

  const isFinesse = weapon.properties?.some(prop => prop.name === 'Finesse');
  const isRanged = weapon.weapon_range === 'Ranged';

  // Determine ability modifier for damage
  let abilityMod = 0;
  if (isRanged || (isFinesse && character.abilities.DEX.modifier > character.abilities.STR.modifier)) {
    abilityMod = character.abilities.DEX.modifier;
  } else {
    abilityMod = character.abilities.STR.modifier;
  }

  const sign = abilityMod >= 0 ? '+' : '';
  return `${weapon.damage.damage_dice}${sign}${abilityMod}`;
};

export const AttacksAndActions: React.FC<AttacksAndActionsProps> = ({
  character,
  setRollResult: _setRollResult,
  onDiceRoll,
  onUpdateCharacter,
  layoutMode = 'modern',
}) => {
  const allEquipment = loadEquipment();

  // Get equipped weapons
  const equippedWeapons = character.equippedWeapons?.map(slug =>
    allEquipment.find(eq => eq.slug === slug)
  ).filter(Boolean) as Equipment[] || [];

  // Check for Extra Attack feature (Fighter, etc.)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _hasExtraAttack = character.level >= 5 && ['fighter', 'paladin', 'ranger'].includes(character.class);

  // Check for Two-Weapon Fighting style
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _hasTwoWeaponFighting = character.selectedFightingStyle === 'Two-Weapon Fighting';

  // Action Surge usage tracking (now uses resource system)
  const getActionSurgeInfo = () => {
    return getResourceUses(character, 'action-surge');
  };

  const canUseActionSurge = () => {
    const info = getActionSurgeInfo();
    return info.current > 0;
  };

  const consumeActionSurge = () => {
    if (canUseActionSurge()) {
      const updatedCharacter = consumeResource(character, 'action-surge');
      onUpdateCharacter(updatedCharacter);
    }
  };

  const handleWeaponAttack = (weapon: Equipment, isExtraAttack = false, isOffHand = false) => {
    const attackBonus = calculateAttackBonus(character, weapon);
    const attackRoll = `1d20${attackBonus >= 0 ? '+' : ''}${attackBonus}`;
    const damageRoll = getWeaponDamage(weapon, character);

    const rollText = `${isExtraAttack ? 'Extra Attack: ' : ''}${isOffHand ? 'Off-hand: ' : ''}${weapon.name} Attack`;

    // Create the roll object for the dice system
    const roll: CustomRoll = {
       id: `attack-${crypto.randomUUID()}`,
      notation: attackRoll,
      type: 'attack' as const,
      description: rollText,
      damageNotation: damageRoll,
      damageType: weapon.damage?.damage_type || 'slashing',
      label: rollText,
      diceResults: [],
      modifier: attackBonus,
      total: attackBonus,
      timestamp: Date.now()
    };

    onDiceRoll(roll);
  };

  const handleSpellAttack = () => {
    if (!character.spellcasting) return;

    const attackBonus = character.spellcasting.spellAttackBonus;
    const attackRoll = `1d20${attackBonus >= 0 ? '+' : ''}${attackBonus}`;

    const roll: CustomRoll = {
      id: `spell-attack-${crypto.randomUUID()}`,
      notation: attackRoll,
      type: 'complex' as const,
      description: 'Spell Attack',
      label: 'Spell Attack',
      diceResults: [],
      modifier: attackBonus,
      total: attackBonus,
      timestamp: Date.now()
    };

    onDiceRoll(roll);
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _handleCantripAttack = (cantripSlug: string) => {
    if (!character.spellcasting) return;

    const attackBonus = character.spellcasting.spellAttackBonus;
    const attackRoll = `1d20${attackBonus >= 0 ? '+' : ''}${attackBonus}`;

    const roll: CustomRoll = {
      id: `cantrip-attack-${cantripSlug}-${crypto.randomUUID()}`,
      notation: attackRoll,
      type: 'complex' as const,
      description: `${cantripSlug} Attack`,
      label: `${cantripSlug} Attack`,
      diceResults: [],
      modifier: attackBonus,
      total: attackBonus,
      timestamp: Date.now()
    };

    onDiceRoll(roll);
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _handleSavingThrow = (ability: keyof Character['abilities']) => {
    const modifier = character.abilities[ability].modifier;
    // TODO: Implement proper saving throw proficiency checking based on class features
    const isProficient = false; // Temporary fix - saving throw proficiency needs proper implementation
    const saveBonus = modifier + (isProficient ? character.proficiencyBonus : 0);
    const saveRoll = `1d20${saveBonus >= 0 ? '+' : ''}${saveBonus}`;

    const roll: CustomRoll = {
      id: `save-${ability}-${crypto.randomUUID()}`,
      notation: saveRoll,
      type: 'saving-throw' as const,
      description: `${ability} Saving Throw`,
      label: `${ability} Saving Throw`,
      diceResults: [],
      modifier: saveBonus,
      total: saveBonus,
      timestamp: Date.now()
    };

    onDiceRoll(roll);
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _handleInitiative = () => {
    const initiativeRoll = `1d20${character.initiative >= 0 ? '+' : ''}${character.initiative}`;

    const roll: CustomRoll = {
      id: `initiative-${crypto.randomUUID()}`,
      notation: initiativeRoll,
      type: 'initiative' as const,
      description: 'Initiative',
      label: 'Initiative',
      diceResults: [],
      modifier: character.initiative,
      total: character.initiative,
      timestamp: Date.now()
    };

    onDiceRoll(roll);
  };

  const handleSkillCheck = (skillName: string, ability: keyof Character['abilities']) => {
    const skill = character.skills[skillName as keyof Character['skills']];
    const skillBonus = skill.value;
    const skillRoll = `1d20${skillBonus >= 0 ? '+' : ''}${skillBonus}`;

    const roll: CustomRoll = {
      id: `skill-${skillName}-${crypto.randomUUID()}`,
      notation: skillRoll,
      type: 'skill' as const,
      description: `${skillName} (${ability}) Check`,
      label: `${skillName} (${ability}) Check`,
      diceResults: [],
      modifier: skillBonus,
      total: skillBonus,
      timestamp: Date.now()
    };

    onDiceRoll(roll);
  };

  const handleUnarmedStrike = () => {
    const strMod = character.abilities.STR.modifier;
    const attackBonus = strMod + character.proficiencyBonus;
    const attackRoll = `1d20${attackBonus >= 0 ? '+' : ''}${attackBonus}`;
    const damageRoll = `1${strMod >= 0 ? '+' : ''}${strMod}`;

    const roll: CustomRoll = {
      id: `unarmed-${crypto.randomUUID()}`,
      notation: attackRoll,
      type: 'attack' as const,
      description: 'Unarmed Strike',
      damageNotation: damageRoll,
      damageType: 'bludgeoning',
      label: 'Unarmed Strike',
      diceResults: [],
      modifier: attackBonus,
      total: attackBonus,
      timestamp: Date.now()
    };

    onDiceRoll(roll);
  };

  const handleCombatAction = (actionSlug: string) => {
    // Special handling for Action Surge
    if (actionSlug === 'action-surge') {
      if (canUseActionSurge()) {
        consumeActionSurge();
      }
      return;
    }

    const allActions = [
      ...COMBAT_ACTIONS.standardActions,
      ...COMBAT_ACTIONS.bonusActions,
      ...COMBAT_ACTIONS.reactions,
      ...COMBAT_ACTIONS.movement,
      ...COMBAT_ACTIONS.classFeatureActions
    ];
    const action = allActions.find(a => a.slug === actionSlug);

    // Consume resource if this action has limited uses
    if (action?.usageType === 'limited') {
      const updatedCharacter = consumeResource(character, actionSlug);
      onUpdateCharacter(updatedCharacter);
    }
    if (!action) return;

    // Handle rollable actions
    if (action.rollType === 'skill' && action.ability && action.skill) {
      handleSkillCheck(action.skill, action.ability);
    } else if (action.rollType === 'healing' && action.notation) {
      const healingRoll = action.notation;
      const levelBonus = action.slug === 'second-wind' && character.class.toLowerCase() === 'fighter' ? character.level : 0;
      const totalNotation = levelBonus > 0 ? `${healingRoll}+${levelBonus}` : healingRoll;

      const roll: CustomRoll = {
        id: `healing-${actionSlug}-${crypto.randomUUID()}`,
        notation: totalNotation,
        type: 'complex' as const,
        description: action.name,
        label: action.name,
        diceResults: [],
        modifier: levelBonus,
        total: levelBonus,
        timestamp: Date.now()
      };

      onDiceRoll(roll);
    }
  };

  // Get class-specific combat actions
  const getClassActions = () => {
    const classSlug = character.class.toLowerCase();
    return COMBAT_ACTIONS.classFeatureActions.filter(action => {
      if (action.class !== classSlug) return false;
      if (action.minLevel && character.level < action.minLevel) return false;
      if (action.subclass && character.subclass?.toLowerCase() !== action.subclass) return false;
      return true;
    });
  };

  const classActions = getClassActions();

  // Transform disparate action data into tactical groups
  const organizeTacticalActions = () => {
    const actions = {
      offense: [] as TacticalAction[],
      defense: [] as TacticalAction[],
      mobility: [] as TacticalAction[],
      burst: [] as TacticalAction[]
    };

    // 1. OFFENSE & CONTROL
    // Add weapon attacks
    equippedWeapons.forEach(weapon => {
      actions.offense.push({
        id: `weapon-${weapon.slug}`,
        name: weapon.name,
        type: 'weapon-attack',
        description: `${weapon.damage?.damage_dice || '1d4'} ${weapon.damage?.damage_type || 'damage'}`,
        actionCost: 'Action',
        hasButton: true,
        buttonText: 'Attack',
        category: 'offense'
      });
    });

    // Add unarmed strike
    actions.offense.push({
      id: 'unarmed-strike',
      name: 'Unarmed Strike',
      type: 'unarmed-attack',
      description: `+${character.abilities.STR.modifier + character.proficiencyBonus} to hit • 1${character.abilities.STR.modifier >= 0 ? '+' : ''}${character.abilities.STR.modifier} bludgeoning`,
      actionCost: 'Action',
      hasButton: true,
      buttonText: 'Attack',
      category: 'offense'
    });

    // Add grapple and shove
    const grappleAction = COMBAT_ACTIONS.standardActions.find(a => a.slug === 'grapple');
    const shoveAction = COMBAT_ACTIONS.standardActions.find(a => a.slug === 'shove');

    if (grappleAction) actions.offense.push({
      id: grappleAction.slug,
      name: grappleAction.name,
      type: 'special-attack',
      description: `+${character.skills.Athletics.value} Athletics vs target's Athletics/Acrobatics`,
      actionCost: 'Action',
      hasButton: true,
      buttonText: 'Contest',
      category: 'offense'
    });

    if (shoveAction) actions.offense.push({
      id: shoveAction.slug,
      name: shoveAction.name,
      type: 'special-attack',
      description: `+${character.skills.Athletics.value} Athletics vs target's Athletics/Acrobatics`,
      actionCost: 'Action',
      hasButton: true,
      buttonText: 'Contest',
      category: 'offense'
    });

    // 2. SURVIVAL & DEFENSE
    const dodgeAction = COMBAT_ACTIONS.standardActions.find(a => a.slug === 'dodge');
    const disengageAction = COMBAT_ACTIONS.standardActions.find(a => a.slug === 'disengage');

    if (dodgeAction) actions.defense.push({
      id: dodgeAction.slug,
      name: dodgeAction.name,
      type: 'defensive',
      description: 'Attack rolls against you have disadvantage',
      actionCost: 'Action',
      hasButton: false,
      category: 'defense'
    });

    if (disengageAction) actions.defense.push({
      id: disengageAction.slug,
      name: disengageAction.name,
      type: 'defensive',
      description: 'Movement doesn\'t provoke opportunity attacks',
      actionCost: 'Action',
      hasButton: false,
      category: 'defense'
    });

    // Add Second Wind for fighters
    const secondWind = classActions.find(a => a.slug === 'second-wind');
    if (secondWind) actions.defense.push({
      id: secondWind.slug,
      name: secondWind.name,
      type: 'healing',
      description: `Regain 1d10 + ${character.level} HP`,
      actionCost: 'Bonus Action',
      hasButton: true,
      buttonText: 'Heal',
      category: 'defense',
      isLimited: true,
      usesRemaining: getResourceUses(character, 'second-wind').current,
      maxUses: getResourceUses(character, 'second-wind').max
    });

    // 3. MOBILITY & SUPPORT
    const dashAction = COMBAT_ACTIONS.standardActions.find(a => a.slug === 'dash');
    const helpAction = COMBAT_ACTIONS.standardActions.find(a => a.slug === 'help');
    const hideAction = COMBAT_ACTIONS.standardActions.find(a => a.slug === 'hide');

    if (dashAction) actions.mobility.push({
      id: dashAction.slug,
      name: dashAction.name,
      type: 'movement',
      description: `Double movement speed (${character.speed * 2}ft total)`,
      actionCost: 'Action',
      hasButton: false,
      category: 'mobility'
    });

    if (helpAction) actions.mobility.push({
      id: helpAction.slug,
      name: helpAction.name,
      type: 'support',
      description: 'Grant advantage on ally\'s next check or attack',
      actionCost: 'Action',
      hasButton: false,
      category: 'mobility'
    });

    if (hideAction) actions.mobility.push({
      id: hideAction.slug,
      name: hideAction.name,
      type: 'stealth',
      description: `+${character.skills.Stealth.value} Stealth check`,
      actionCost: 'Action',
      hasButton: false,
      category: 'mobility'
    });

    // Add Bardic Inspiration for bards
    const bardicInspiration = classActions.find(a => a.slug === 'bardic-inspiration');
    if (bardicInspiration) actions.mobility.push({
      id: bardicInspiration.slug,
      name: bardicInspiration.name,
      type: 'support',
      description: 'Give ally d6 inspiration die for checks/attacks/saves',
      actionCost: 'Bonus Action',
      hasButton: false,
      category: 'mobility',
      isLimited: true,
      usesRemaining: getResourceUses(character, 'bardic-inspiration').current,
      maxUses: getResourceUses(character, 'bardic-inspiration').max
    });

    // 4. BURST / SPECIAL
    const readyAction = COMBAT_ACTIONS.standardActions.find(a => a.slug === 'ready');

    // Add Action Surge for fighters
    const actionSurge = classActions.find(a => a.slug === 'action-surge');
    if (actionSurge) actions.burst.push({
      id: actionSurge.slug,
      name: actionSurge.name,
      type: 'action-surge',
      description: 'Take one additional action this turn',
      actionCost: 'Free',
      hasButton: false,
      category: 'burst',
      isLimited: true,
      usesRemaining: getActionSurgeInfo().current,
      maxUses: getActionSurgeInfo().max,
      specialUI: 'bubble-display' // Special handling for bubble UI
    });

    if (readyAction) actions.burst.push({
      id: readyAction.slug,
      name: readyAction.name,
      type: 'reaction-setup',
      description: 'Prepare action for specific trigger',
      actionCost: 'Action',
      hasButton: false,
      category: 'burst'
    });

    return actions;
  };

  const organizedActions = organizeTacticalActions();

  // Determine color scheme based on layout mode
  const isPaperSheet = layoutMode === 'paper-sheet';
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _bgSecondaryClass = isPaperSheet ? 'bg-[#fcf6e3]' : 'bg-theme-secondary';
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _bgTertiaryClass = isPaperSheet ? 'bg-[#f5ebd2]' : 'bg-theme-tertiary/50';
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _textPrimaryClass = isPaperSheet ? 'text-[#1e140a]' : 'text-theme-primary';
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _textMutedClass = isPaperSheet ? 'text-[#3d2817]' : 'text-theme-muted';
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _textTertiaryClass = isPaperSheet ? 'text-[#3d2817]' : 'text-theme-tertiary';
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _borderClass = isPaperSheet ? 'border-[#1e140a]/20' : 'border-red-800';

  // Handle tactical action clicks
  const handleTacticalAction = (actionId: string) => {
    if (actionId.startsWith('weapon-')) {
      const weaponSlug = actionId.replace('weapon-', '');
      const weapon = equippedWeapons.find(w => w.slug === weaponSlug);
      if (weapon) handleWeaponAttack(weapon);
    } else if (actionId === 'unarmed-strike') {
      handleUnarmedStrike();
    } else if (actionId === 'second-wind') {
      // Handle Second Wind healing
      const healingRoll = `1d10+${character.level}`;
      // Create the roll object for the dice system
      const roll: CustomRoll = {
        id: `second-wind-${crypto.randomUUID()}`,
        notation: healingRoll,
        type: 'complex' as const,
        description: 'Second Wind Healing',
        label: 'Second Wind',
        diceResults: [],
        modifier: character.level,
        total: character.level,
        timestamp: Date.now()
      };
      onDiceRoll(roll);
    } else {
      // Handle other tactical actions
      handleCombatAction(actionId);
    }
  };

  return (
    <div className="space-y-6">
      {/* Main Header */}
      <div className={`flex items-center justify-between gap-3 pb-2 border-b-2 ${
        layoutMode === 'paper-sheet'
          ? 'border-[#1e140a]/30 text-[#1e140a]'
          : 'border-theme-border text-theme-primary'
      }`}>
        <div className="flex items-center gap-2">
          <span className="text-xl">⚔️</span>
          <h2 className="text-2xl font-bold tracking-tight">Combat Options</h2>
        </div>
        <span className={`text-xs uppercase tracking-[0.2em] font-semibold ${
          layoutMode === 'paper-sheet' ? 'text-[#3d2817]' : 'text-theme-muted'
        }`}>
          Attacks & Spellcasting
        </span>
      </div>

      {/* Spell Attacks Section (if applicable) */}
      {character.spellcasting && (
        <TacticalSection
          icon="🔮"
          title="Spellcasting"
          theme="purple"
          actions={[
            {
              id: 'spell-attack',
              name: 'Spell Attack',
              type: 'spell-attack',
              description: `+${character.spellcasting.spellAttackBonus} to hit`,
              actionCost: 'Action',
              hasButton: true,
              buttonText: 'Roll Attack',
              category: 'offense'
            },
            {
              id: 'spell-save-dc',
              name: 'Spell Save DC',
              type: 'spell-attack',
              description: `DC ${character.spellcasting.spellSaveDC} for enemy saves`,
              actionCost: 'Action',
              hasButton: false,
              category: 'offense'
            }
          ]}
          onAction={(actionId) => {
            if (actionId === 'spell-attack') handleSpellAttack();
          }}
          layoutMode={layoutMode}
        />
      )}

      {/* Main Tactical Sections */}
      <TacticalSection
        icon="⚔️"
        title="Offense & Control"
        theme="red"
        actions={organizedActions.offense}
        onAction={handleTacticalAction}
        layoutMode={layoutMode}
      />

      <TacticalSection
        icon="🛡️"
        title="Survival & Defense"
        theme="blue"
        actions={organizedActions.defense}
        onAction={handleTacticalAction}
        layoutMode={layoutMode}
      />

      <TacticalSection
        icon="🏃"
        title="Mobility & Support"
        theme="green"
        actions={organizedActions.mobility}
        onAction={handleTacticalAction}
        layoutMode={layoutMode}
      />

      <TacticalSection
        icon="⚡"
        title="Burst / Special"
        theme="orange"
        actions={organizedActions.burst}
        onAction={handleTacticalAction}
        layoutMode={layoutMode}
      />
    </div>
  );
};
