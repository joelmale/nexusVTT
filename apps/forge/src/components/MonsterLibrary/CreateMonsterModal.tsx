import React, { useRef, useState } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import { UserMonster, MonsterSize, MonsterType } from '../../types/dnd';
import { useMonsterContext } from '../../hooks';
import { MONSTER_TYPE_CATEGORIES } from '../../services/dataService';

interface CreateMonsterModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingMonster?: UserMonster | null;
}

const MONSTER_SIZES: MonsterSize[] = ['Tiny', 'Small', 'Medium', 'Large', 'Huge', 'Gargantuan'];

export const CreateMonsterModal: React.FC<CreateMonsterModalProps> = ({
  isOpen,
  onClose,
  editingMonster,
}) => {
  const { createCustomMonster, updateCustomMonster } = useMonsterContext();

  // Creation timestamp - generated when component mounts
  const createdAtRef = useRef(new Date().getTime());

  // Basic Info
  const [name, setName] = useState(editingMonster?.name || '');
  const [size, setSize] = useState<MonsterSize>(editingMonster?.size || 'Medium');
  const [type, setType] = useState<MonsterType>(editingMonster?.type || 'beast');
  const [alignment, setAlignment] = useState(editingMonster?.alignment || 'unaligned');

  // Stats
  const [ac, setAc] = useState(editingMonster?.armor_class?.[0]?.value || 10);
  const [hp, setHp] = useState(editingMonster?.hit_points || 10);
  const [hitDice, setHitDice] = useState(editingMonster?.hit_dice || '2d8');

  // Ability Scores
  const [str, setStr] = useState(editingMonster?.strength || 10);
  const [dex, setDex] = useState(editingMonster?.dexterity || 10);
  const [con, setCon] = useState(editingMonster?.constitution || 10);
  const [int, setInt] = useState(editingMonster?.intelligence || 10);
  const [wis, setWis] = useState(editingMonster?.wisdom || 10);
  const [cha, setCha] = useState(editingMonster?.charisma || 10);

  // Speed
  const [walkSpeed, setWalkSpeed] = useState(editingMonster?.speed?.walk || '30 ft.');
  const [flySpeed, setFlySpeed] = useState(editingMonster?.speed?.fly || '');
  const [swimSpeed, setSwimSpeed] = useState(editingMonster?.speed?.swim || '');
  const [burrowSpeed, setBurrowSpeed] = useState(editingMonster?.speed?.burrow || '');
  const [climbSpeed, setClimbSpeed] = useState(editingMonster?.speed?.climb || '');
  const [hover, setHover] = useState(editingMonster?.speed?.hover || false);

  // Challenge
  const [cr, setCr] = useState(editingMonster?.challenge_rating || 0);
  const [xp, setXp] = useState(editingMonster?.xp || 10);

  // Other
  const [senses, setSenses] = useState(editingMonster?.senses ? Object.entries(editingMonster.senses).map(([k, v]) => `${k} ${v}`).join(', ') : 'passive Perception 10');
  const [languages, setLanguages] = useState(editingMonster?.languages || '—');

  // Abilities & Actions
  const [specialAbilities, setSpecialAbilities] = useState(editingMonster?.special_abilities?.map(a => ({ name: a.name, desc: a.desc })) || []);
  const [actions, setActions] = useState(editingMonster?.actions?.map(a => ({ name: a.name, desc: a.desc })) || []);
  const [legendaryActions, setLegendaryActions] = useState(editingMonster?.legendary_actions?.map(a => ({ name: a.name, desc: a.desc })) || []);



  const handleSave = async () => {
    if (!name.trim()) {
      alert('Please enter a monster name');
      return;
    }

    const proficiencyBonus = Math.ceil(cr / 4) + 1;

    const now = new Date().getTime();
    const monster: UserMonster = {
      index: editingMonster?.index || `custom-${name.toLowerCase().replace(/\s+/g, '-')}-${now}`,
      id: editingMonster?.id || crypto.randomUUID(),
      isCustom: true,
      createdAt: editingMonster?.createdAt ?? createdAtRef.current,
      updatedAt: now,
      name,
      size,
      type,
      alignment,
      armor_class: [{ type: 'natural', value: ac }],
      hit_points: hp,
      hit_dice: hitDice,
      hit_points_roll: hitDice,
      speed: {
        walk: walkSpeed || undefined,
        fly: flySpeed || undefined,
        swim: swimSpeed || undefined,
        burrow: burrowSpeed || undefined,
        climb: climbSpeed || undefined,
        hover: hover || undefined,
      },
      strength: str,
      dexterity: dex,
      constitution: con,
      intelligence: int,
      wisdom: wis,
      charisma: cha,
      proficiencies: [],
      damage_vulnerabilities: [],
      damage_resistances: [],
      damage_immunities: [],
      condition_immunities: [],
      senses: senses.split(',').reduce((acc, sense) => {
        const [key, ...value] = sense.trim().split(' ');
        if (key) acc[key.toLowerCase()] = value.join(' ');
        return acc;
      }, {} as Record<string, string>),
      languages,
      challenge_rating: cr,
      proficiency_bonus: proficiencyBonus,
      xp,
      special_abilities: specialAbilities.length > 0 ? specialAbilities.map(a => ({ ...a })) : undefined,
      actions: actions.length > 0 ? actions.map(a => ({ ...a })) : undefined,
      legendary_actions: legendaryActions.length > 0 ? legendaryActions.map(a => ({ ...a })) : undefined,
    };

    const success = editingMonster
      ? await updateCustomMonster(monster)
      : await createCustomMonster(monster);

    if (success) {
      onClose();
      resetForm();
    }
  };

  const resetForm = () => {
    setName('');
    setSize('Medium');
    setType('beast');
    setAlignment('unaligned');
    setAc(10);
    setHp(10);
    setHitDice('2d8');
    setStr(10);
    setDex(10);
    setCon(10);
    setInt(10);
    setWis(10);
    setCha(10);
    setWalkSpeed('30 ft.');
    setFlySpeed('');
    setSwimSpeed('');
    setBurrowSpeed('');
    setClimbSpeed('');
    setHover(false);
    setCr(0);
    setXp(10);
    setSenses('passive Perception 10');
    setLanguages('—');
    setSpecialAbilities([]);
    setActions([]);
    setLegendaryActions([]);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-theme-primary rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-purple-900 to-green-900 p-4 flex justify-between items-center rounded-t-lg z-10">
          <h2 className="text-2xl font-bold text-white">
            {editingMonster ? 'Edit Custom Monster' : 'Create Custom Monster'}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
            <X className="w-6 h-6 text-white" />
          </button>
        </div>

        {/* Form */}
        <div className="p-6 space-y-6">
          {/* Basic Info */}
          <section className="space-y-4">
            <h3 className="text-xl font-bold text-accent-purple-light border-b border-accent-purple-dark pb-2">Basic Information</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-theme-tertiary mb-2">Name *</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 bg-theme-secondary text-white rounded-lg border border-theme-secondary focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="Ancient Red Dragon"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-theme-tertiary mb-2">Size</label>
                <select
                  value={size}
                  onChange={(e) => setSize(e.target.value as MonsterSize)}
                  className="w-full px-3 py-2 bg-theme-secondary text-white rounded-lg border border-theme-secondary focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  {MONSTER_SIZES.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-theme-tertiary mb-2">Type</label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as MonsterType)}
                  className="w-full px-3 py-2 bg-theme-secondary text-white rounded-lg border border-theme-secondary focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  {MONSTER_TYPE_CATEGORIES.map(cat => (
                    <option key={cat.type} value={cat.type}>
                      {cat.icon} {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-theme-tertiary mb-2">Alignment</label>
                <input
                  type="text"
                  value={alignment}
                  onChange={(e) => setAlignment(e.target.value)}
                  className="w-full px-3 py-2 bg-theme-secondary text-white rounded-lg border border-theme-secondary focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="lawful evil"
                />
              </div>
            </div>
          </section>

          {/* Combat Stats */}
          <section className="space-y-4">
            <h3 className="text-xl font-bold text-accent-red-light border-b border-accent-red-dark pb-2">Combat Stats</h3>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-semibold text-theme-tertiary mb-2">Armor Class</label>
                <input
                  type="number"
                  value={ac}
                  onChange={(e) => setAc(parseInt(e.target.value) || 10)}
                  className="w-full px-3 py-2 bg-theme-secondary text-white rounded-lg border border-theme-secondary focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-theme-tertiary mb-2">Hit Points</label>
                <input
                  type="number"
                  value={hp}
                  onChange={(e) => setHp(parseInt(e.target.value) || 10)}
                  className="w-full px-3 py-2 bg-theme-secondary text-white rounded-lg border border-theme-secondary focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-theme-tertiary mb-2">Hit Dice</label>
                <input
                  type="text"
                  value={hitDice}
                  onChange={(e) => setHitDice(e.target.value)}
                  className="w-full px-3 py-2 bg-theme-secondary text-white rounded-lg border border-theme-secondary focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="18d10+36"
                />
              </div>
            </div>
          </section>

          {/* Ability Scores */}
          <section className="space-y-4">
            <h3 className="text-xl font-bold text-accent-yellow-light border-b border-accent-yellow-dark pb-2">Ability Scores</h3>

            <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
              {[
                { label: 'STR', value: str, setter: setStr },
                { label: 'DEX', value: dex, setter: setDex },
                { label: 'CON', value: con, setter: setCon },
                { label: 'INT', value: int, setter: setInt },
                { label: 'WIS', value: wis, setter: setWis },
                { label: 'CHA', value: cha, setter: setCha },
              ].map(({ label, value, setter }) => (
                <div key={label}>
                  <label className="block text-sm font-semibold text-theme-tertiary mb-2 text-center">{label}</label>
                  <input
                    type="number"
                    value={value}
                    onChange={(e) => setter(parseInt(e.target.value) || 10)}
                    className="w-full px-3 py-2 bg-theme-secondary text-white rounded-lg border border-theme-secondary focus:outline-none focus:ring-2 focus:ring-purple-500 text-center"
                  />
                </div>
              ))}
            </div>
          </section>

          {/* Speed */}
          <section className="space-y-4">
            <h3 className="text-xl font-bold text-accent-blue-light border-b border-accent-blue-dark pb-2">Speed</h3>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-semibold text-theme-tertiary mb-2">Walk</label>
                <input
                  type="text"
                  value={walkSpeed}
                  onChange={(e) => setWalkSpeed(e.target.value)}
                  className="w-full px-3 py-2 bg-theme-secondary text-white rounded-lg border border-theme-secondary focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="30 ft."
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-theme-tertiary mb-2">Fly (optional)</label>
                <input
                  type="text"
                  value={flySpeed}
                  onChange={(e) => setFlySpeed(e.target.value)}
                  className="w-full px-3 py-2 bg-theme-secondary text-white rounded-lg border border-theme-secondary focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="60 ft."
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-theme-tertiary mb-2">Swim (optional)</label>
                <input
                  type="text"
                  value={swimSpeed}
                  onChange={(e) => setSwimSpeed(e.target.value)}
                  className="w-full px-3 py-2 bg-theme-secondary text-white rounded-lg border border-theme-secondary focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="40 ft."
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-theme-tertiary mb-2">Burrow (optional)</label>
                <input
                  type="text"
                  value={burrowSpeed}
                  onChange={(e) => setBurrowSpeed(e.target.value)}
                  className="w-full px-3 py-2 bg-theme-secondary text-white rounded-lg border border-theme-secondary focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="20 ft."
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-theme-tertiary mb-2">Climb (optional)</label>
                <input
                  type="text"
                  value={climbSpeed}
                  onChange={(e) => setClimbSpeed(e.target.value)}
                  className="w-full px-3 py-2 bg-theme-secondary text-white rounded-lg border border-theme-secondary focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="30 ft."
                />
              </div>

              <div className="flex items-end">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={hover}
                    onChange={(e) => setHover(e.target.checked)}
                    className="w-4 h-4 text-accent-purple bg-theme-tertiary border-theme-primary rounded focus:ring-purple-500"
                  />
                  <span className="text-sm text-theme-tertiary">Hover</span>
                </label>
              </div>
            </div>
          </section>

          {/* Challenge & XP */}
          <section className="space-y-4">
            <h3 className="text-xl font-bold text-orange-400 border-b border-orange-700 pb-2">Challenge</h3>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-theme-tertiary mb-2">Challenge Rating</label>
                <input
                  type="number"
                  value={cr}
                  onChange={(e) => setCr(parseFloat(e.target.value) || 0)}
                  step="0.125"
                  className="w-full px-3 py-2 bg-theme-secondary text-white rounded-lg border border-theme-secondary focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-theme-tertiary mb-2">XP</label>
                <input
                  type="number"
                  value={xp}
                  onChange={(e) => setXp(parseInt(e.target.value) || 10)}
                  className="w-full px-3 py-2 bg-theme-secondary text-white rounded-lg border border-theme-secondary focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
            </div>
          </section>

          {/* Senses & Languages */}
          <section className="space-y-4">
            <h3 className="text-xl font-bold text-cyan-400 border-b border-cyan-700 pb-2">Senses & Languages</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-theme-tertiary mb-2">Senses</label>
                <input
                  type="text"
                  value={senses}
                  onChange={(e) => setSenses(e.target.value)}
                  className="w-full px-3 py-2 bg-theme-secondary text-white rounded-lg border border-theme-secondary focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="darkvision 60 ft., passive Perception 12"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-theme-tertiary mb-2">Languages</label>
                <input
                  type="text"
                  value={languages}
                  onChange={(e) => setLanguages(e.target.value)}
                  className="w-full px-3 py-2 bg-theme-secondary text-white rounded-lg border border-theme-secondary focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="Common, Draconic"
                />
              </div>
            </div>
          </section>

          {/* Special Abilities */}
          <section className="space-y-4">
            <div className="flex justify-between items-center border-b border-accent-purple-dark pb-2">
              <h3 className="text-xl font-bold text-accent-purple-light">Special Abilities</h3>
              <button
                onClick={() => setSpecialAbilities([...specialAbilities, { name: '', desc: '' }])}
                className="px-3 py-1 bg-accent-purple hover:bg-purple-700 text-white rounded-lg text-sm flex items-center gap-1"
              >
                <Plus className="w-4 h-4" /> Add
              </button>
            </div>

            {specialAbilities.map((ability, idx) => (
              <div key={idx} className="bg-theme-secondary p-4 rounded-lg space-y-2">
                <div className="flex justify-between items-start gap-2">
                  <input
                    type="text"
                    value={ability.name}
                    onChange={(e) => {
                      const updated = [...specialAbilities];
                      updated[idx].name = e.target.value;
                      setSpecialAbilities(updated);
                    }}
                    className="flex-grow px-3 py-2 bg-theme-tertiary text-white rounded-lg border border-theme-primary focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="Ability Name"
                  />
                  <button
                    onClick={() => setSpecialAbilities(specialAbilities.filter((_, i) => i !== idx))}
                    className="p-2 bg-accent-red hover:bg-accent-red-dark rounded-lg"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <textarea
                  value={ability.desc}
                  onChange={(e) => {
                    const updated = [...specialAbilities];
                    updated[idx].desc = e.target.value;
                    setSpecialAbilities(updated);
                  }}
                  className="w-full px-3 py-2 bg-theme-tertiary text-white rounded-lg border border-theme-primary focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="Ability description..."
                  rows={3}
                />
              </div>
            ))}
          </section>

          {/* Actions */}
          <section className="space-y-4">
            <div className="flex justify-between items-center border-b border-accent-red-dark pb-2">
              <h3 className="text-xl font-bold text-accent-red-light">Actions</h3>
              <button
                onClick={() => setActions([...actions, { name: '', desc: '' }])}
                className="px-3 py-1 bg-accent-red hover:bg-accent-red-dark text-white rounded-lg text-sm flex items-center gap-1"
              >
                <Plus className="w-4 h-4" /> Add
              </button>
            </div>

            {actions.map((action, idx) => (
              <div key={idx} className="bg-theme-secondary p-4 rounded-lg space-y-2">
                <div className="flex justify-between items-start gap-2">
                  <input
                    type="text"
                    value={action.name}
                    onChange={(e) => {
                      const updated = [...actions];
                      updated[idx].name = e.target.value;
                      setActions(updated);
                    }}
                    className="flex-grow px-3 py-2 bg-theme-tertiary text-white rounded-lg border border-theme-primary focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="Action Name"
                  />
                  <button
                    onClick={() => setActions(actions.filter((_, i) => i !== idx))}
                    className="p-2 bg-accent-red hover:bg-accent-red-dark rounded-lg"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <textarea
                  value={action.desc}
                  onChange={(e) => {
                    const updated = [...actions];
                    updated[idx].desc = e.target.value;
                    setActions(updated);
                  }}
                  className="w-full px-3 py-2 bg-theme-tertiary text-white rounded-lg border border-theme-primary focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="Action description..."
                  rows={3}
                />
              </div>
            ))}
          </section>

          {/* Legendary Actions */}
          <section className="space-y-4">
            <div className="flex justify-between items-center border-b border-accent-yellow-dark pb-2">
              <h3 className="text-xl font-bold text-accent-yellow-light">Legendary Actions (Optional)</h3>
              <button
                onClick={() => setLegendaryActions([...legendaryActions, { name: '', desc: '' }])}
                className="px-3 py-1 bg-accent-yellow-dark hover:bg-yellow-700 text-white rounded-lg text-sm flex items-center gap-1"
              >
                <Plus className="w-4 h-4" /> Add
              </button>
            </div>

            {legendaryActions.map((action, idx) => (
              <div key={idx} className="bg-theme-secondary p-4 rounded-lg space-y-2">
                <div className="flex justify-between items-start gap-2">
                  <input
                    type="text"
                    value={action.name}
                    onChange={(e) => {
                      const updated = [...legendaryActions];
                      updated[idx].name = e.target.value;
                      setLegendaryActions(updated);
                    }}
                    className="flex-grow px-3 py-2 bg-theme-tertiary text-white rounded-lg border border-theme-primary focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="Legendary Action Name"
                  />
                  <button
                    onClick={() => setLegendaryActions(legendaryActions.filter((_, i) => i !== idx))}
                    className="p-2 bg-accent-red hover:bg-accent-red-dark rounded-lg"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <textarea
                  value={action.desc}
                  onChange={(e) => {
                    const updated = [...legendaryActions];
                    updated[idx].desc = e.target.value;
                    setLegendaryActions(updated);
                  }}
                  className="w-full px-3 py-2 bg-theme-tertiary text-white rounded-lg border border-theme-primary focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="Legendary action description..."
                  rows={3}
                />
              </div>
            ))}
          </section>
        </div>

        {/* Footer Buttons */}
        <div className="sticky bottom-0 bg-theme-secondary p-4 flex justify-end gap-3 rounded-b-lg border-t border-theme-secondary">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-theme-tertiary hover:bg-theme-quaternary text-white rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-6 py-2 bg-accent-green hover:bg-accent-green-dark text-white rounded-lg transition-colors font-semibold"
          >
            {editingMonster ? 'Update Monster' : 'Create Monster'}
          </button>
        </div>
      </div>
    </div>
  );
};
