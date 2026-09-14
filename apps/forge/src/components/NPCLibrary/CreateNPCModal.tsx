import React, { useState, useEffect } from 'react';
import { X, Shuffle } from 'lucide-react';
import { NPC } from '../../types/dnd';
import { useNPCContext } from '../../hooks/useNPCContext';
import { generateCompleteNPC } from '../../utils/npcGenerationUtils';
import { RichTextEditor } from './RichTextEditor';

interface CreateNPCModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingNPC?: NPC | null;
}

export const CreateNPCModal: React.FC<CreateNPCModalProps> = ({
  isOpen,
  onClose,
  editingNPC,
}) => {
  const { createNPC, updateNPC } = useNPCContext();

  const [name, setName] = useState(editingNPC?.name || '');
  const [species, setSpecies] = useState(editingNPC?.species || '');
  const [occupation, setOccupation] = useState(editingNPC?.occupation || '');
  const [alignment, setAlignment] = useState(editingNPC?.alignment || '');
  const [personalityTraits, setPersonalityTraits] = useState<string[]>(editingNPC?.personalityTraits || []);
  const [abilityScores, setAbilityScores] = useState<Record<string, number>>(editingNPC?.abilityScores || {
    STR: 10, DEX: 10, CON: 10, INT: 10, WIS: 10, CHA: 10
  });
  const [relationshipStatus, setRelationshipStatus] = useState(editingNPC?.relationshipStatus || '');
  const [sexualOrientation, setSexualOrientation] = useState(editingNPC?.sexualOrientation || '');
  const [plotHook, setPlotHook] = useState(editingNPC?.plotHook || '');
  const [notes, setNotes] = useState(editingNPC?.notes || '');

  // Reset form when modal opens/closes or editing NPC changes
  useEffect(() => {
    if (isOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setName(editingNPC?.name || '');
      setSpecies(editingNPC?.species || '');
      setOccupation(editingNPC?.occupation || '');
      setAlignment(editingNPC?.alignment || '');
      setPersonalityTraits(editingNPC?.personalityTraits || []);
      setAbilityScores(editingNPC?.abilityScores || {
        STR: 10, DEX: 10, CON: 10, INT: 10, WIS: 10, CHA: 10
      });
      setRelationshipStatus(editingNPC?.relationshipStatus || '');
      setSexualOrientation(editingNPC?.sexualOrientation || '');
      setPlotHook(editingNPC?.plotHook || '');
      setNotes(editingNPC?.notes || '');
    }
  }, [isOpen, editingNPC]);

  const handleGenerateRandom = () => {
    const randomNPC = generateCompleteNPC();
    setName(randomNPC.name);
    setSpecies(randomNPC.species);
    setOccupation(randomNPC.occupation);
    setPersonalityTraits(randomNPC.personalityTraits);
    setAbilityScores(randomNPC.abilityScores);
    setAlignment(randomNPC.alignment);
    setRelationshipStatus(randomNPC.relationshipStatus);
    setSexualOrientation(randomNPC.sexualOrientation);
    setPlotHook(randomNPC.plotHook);
    setNotes(randomNPC.notes);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      alert('Please enter a name for the NPC');
      return;
    }

    const npcData: NPC = {
      id: editingNPC?.id || crypto.randomUUID(),
      name: name.trim(),
      species: species.trim(),
      occupation: occupation.trim(),
      personalityTraits,
      abilityScores,
      alignment: alignment.trim(),
      relationshipStatus: relationshipStatus.trim(),
      sexualOrientation: sexualOrientation.trim(),
      plotHook: plotHook.trim(),
      notes,
      createdAt: editingNPC?.createdAt || Date.now(),
      updatedAt: Date.now(),
    };

    const success = editingNPC
      ? await updateNPC(npcData)
      : await createNPC(npcData);

    if (success) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-theme-primary rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-purple-900 to-green-900 p-4 flex justify-between items-center rounded-t-lg z-10">
          <div className="flex items-center gap-4">
            <h2 className="text-2xl font-bold text-white">
              {editingNPC ? 'Edit NPC' : 'Create New NPC'}
            </h2>
            {!editingNPC && (
              <button
                onClick={handleGenerateRandom}
                className="px-3 py-1 bg-purple-700 hover:bg-purple-600 text-white rounded-lg text-sm flex items-center gap-2 transition-colors"
                title="Generate Random NPC"
              >
                <Shuffle className="w-4 h-4" />
                Random
              </button>
            )}
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
            <X className="w-6 h-6 text-white" />
          </button>
        </div>

        {/* Form */}
        <div className="p-6 space-y-6">
          {/* Basic Info */}
          <section className="space-y-4">
            <h3 className="text-xl font-bold text-accent-purple-light border-b border-accent-purple-dark pb-2">
              Basic Information
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-theme-tertiary mb-2">Name *</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 bg-theme-secondary text-white rounded-lg border border-theme-secondary focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="Enter NPC name"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-theme-tertiary mb-2">Species</label>
                <input
                  type="text"
                  value={species}
                  onChange={(e) => setSpecies(e.target.value)}
                  className="w-full px-3 py-2 bg-theme-secondary text-white rounded-lg border border-theme-secondary focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="e.g., Human, Elf, Dwarf"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-theme-tertiary mb-2">Occupation</label>
                <input
                  type="text"
                  value={occupation}
                  onChange={(e) => setOccupation(e.target.value)}
                  className="w-full px-3 py-2 bg-theme-secondary text-white rounded-lg border border-theme-secondary focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="e.g., Merchant, Guard, Wizard"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-theme-tertiary mb-2">Alignment</label>
                <input
                  type="text"
                  value={alignment}
                  onChange={(e) => setAlignment(e.target.value)}
                  className="w-full px-3 py-2 bg-theme-secondary text-white rounded-lg border border-theme-secondary focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="e.g., Lawful Good, Chaotic Neutral"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-theme-tertiary mb-2">Relationship Status</label>
                <input
                  type="text"
                  value={relationshipStatus}
                  onChange={(e) => setRelationshipStatus(e.target.value)}
                  className="w-full px-3 py-2 bg-theme-secondary text-white rounded-lg border border-theme-secondary focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="e.g., Single, Married, Widowed"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-theme-tertiary mb-2">Sexual Orientation</label>
                <input
                  type="text"
                  value={sexualOrientation}
                  onChange={(e) => setSexualOrientation(e.target.value)}
                  className="w-full px-3 py-2 bg-theme-secondary text-white rounded-lg border border-theme-secondary focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="e.g., Heterosexual, Homosexual, Bisexual"
                />
              </div>
            </div>

            {/* Ability Scores */}
            <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
              {Object.entries(abilityScores).map(([ability, score]) => (
                <div key={ability}>
                  <label className="block text-sm font-semibold text-theme-tertiary mb-2 text-center">{ability}</label>
                  <input
                    type="number"
                    value={score}
                    onChange={(e) => setAbilityScores(prev => ({
                      ...prev,
                      [ability]: parseInt(e.target.value) || 10
                    }))}
                    className="w-full px-3 py-2 bg-theme-secondary text-white rounded-lg border border-theme-secondary focus:outline-none focus:ring-2 focus:ring-purple-500 text-center"
                    min="1"
                    max="30"
                  />
                </div>
              ))}
            </div>

            {/* Personality Traits */}
            <div>
              <label className="block text-sm font-semibold text-theme-tertiary mb-2">Personality Traits</label>
              <textarea
                value={personalityTraits.join('\n')}
                onChange={(e) => setPersonalityTraits(e.target.value.split('\n').filter(t => t.trim()))}
                className="w-full px-3 py-2 bg-theme-secondary text-white rounded-lg border border-theme-secondary focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="Enter personality traits (one per line)"
                rows={3}
              />
            </div>

            {/* Plot Hook */}
            <div>
              <label className="block text-sm font-semibold text-theme-tertiary mb-2">Plot Hook</label>
              <textarea
                value={plotHook}
                onChange={(e) => setPlotHook(e.target.value)}
                className="w-full px-3 py-2 bg-theme-secondary text-white rounded-lg border border-theme-secondary focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="Enter a plot hook or background detail"
                rows={2}
              />
            </div>
          </section>

          {/* Notes */}
          <section className="space-y-4">
            <h3 className="text-xl font-bold text-accent-green-light border-b border-accent-green-dark pb-2">
              Notes
            </h3>

            <div>
              <RichTextEditor
                value={notes}
                onChange={setNotes}
                placeholder="Add background, personality details, plot hooks..."
              />
            </div>
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
            {editingNPC ? 'Update NPC' : 'Create NPC'}
          </button>
        </div>
      </div>
    </div>
  );
};