import React, { useState } from 'react';
import { X } from 'lucide-react';
import type { PlacedToken } from '@/types/token';
import { useGameStore } from '@/stores/gameStore';
import { useInitiativeStore } from '@/stores/initiativeStore';
import './NPCStatsPrompt.css';

interface NPCStatsPromptProps {
  token: PlacedToken;
  onClose: () => void;
}

export const NPCStatsPrompt: React.FC<NPCStatsPromptProps> = ({
  token,
  onClose,
}) => {
  const [name, setName] = useState(token.nameOverride || 'Unknown Creature');
  const [maxHP, setMaxHP] = useState<number>(10);
  const [currentHP, setCurrentHP] = useState<number>(10);
  const [armorClass, setArmorClass] = useState<number>(10);
  const [initiativeModifier, setInitiativeModifier] = useState<number>(0);
  const [dexterityModifier, setDexterityModifier] = useState<number>(0);
  const [type, setType] = useState<'npc' | 'monster'>('monster');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const { user } = useGameStore.getState();
    const { addEntry } = useInitiativeStore.getState();

    // Create stat snapshot
    const entry = {
      id: crypto.randomUUID(),
      name,
      currentHP,
      maxHP,
      tempHP: 0,
      armorClass,
      initiative: 0, // Will be rolled when combat starts
      initiativeModifier,
      dexterityModifier,
      type,
      tokenId: token.id,
      conditions: [],
      isActive: false,
      isReady: false,
      isDelayed: false,
      notes: '',
      deathSaves: { successes: 0, failures: 0 },
    };

    // Add to local initiative
    addEntry(entry);

    // Broadcast stat snapshot to peers
    const { webSocketService } = await import('@/services/websocket');
    webSocketService.sendEvent({
      type: 'event',
      data: {
        name: 'combat/add-character',
        sourceClientId: user.id,
        tokenId: token.id,
        entry: {
          name: entry.name,
          currentHP: entry.currentHP,
          maxHP: entry.maxHP,
          tempHP: entry.tempHP,
          armorClass: entry.armorClass,
          initiative: entry.initiative,
          initiativeModifier: entry.initiativeModifier,
          dexterityModifier: entry.dexterityModifier,
          type: entry.type,
        },
      },
    });

    console.log('⚔️ Added NPC/Monster to combat:', name);
    onClose();
  };

  const handleMaxHPChange = (value: number) => {
    setMaxHP(value);
    // Update current HP to match if it's higher
    if (currentHP > value) {
      setCurrentHP(value);
    }
  };

  return (
    <div className="npc-stats-prompt-overlay" onClick={onClose}>
      <div
        className="npc-stats-prompt-modal"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="npc-stats-prompt-header">
          <h2>Add to Combat</h2>
          <button
            className="close-btn"
            onClick={onClose}
            aria-label="Close"
            type="button"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="npc-stats-prompt-form">
          {/* Name */}
          <div className="form-group">
            <label htmlFor="npc-name">Name</label>
            <input
              id="npc-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="form-input"
              required
            />
          </div>

          {/* Type */}
          <div className="form-group">
            <label htmlFor="npc-type">Type</label>
            <select
              id="npc-type"
              value={type}
              onChange={(e) => setType(e.target.value as 'npc' | 'monster')}
              className="form-select"
            >
              <option value="monster">Monster</option>
              <option value="npc">NPC</option>
            </select>
          </div>

          {/* HP */}
          <div className="form-group-row">
            <div className="form-group">
              <label htmlFor="npc-max-hp">Max HP</label>
              <input
                id="npc-max-hp"
                type="number"
                min="1"
                max="999"
                value={maxHP}
                onChange={(e) =>
                  handleMaxHPChange(parseInt(e.target.value) || 1)
                }
                className="form-input"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="npc-current-hp">Current HP</label>
              <input
                id="npc-current-hp"
                type="number"
                min="0"
                max={maxHP}
                value={currentHP}
                onChange={(e) => setCurrentHP(parseInt(e.target.value) || 0)}
                className="form-input"
                required
              />
            </div>
          </div>

          {/* AC */}
          <div className="form-group">
            <label htmlFor="npc-ac">Armor Class (AC)</label>
            <input
              id="npc-ac"
              type="number"
              min="1"
              max="99"
              value={armorClass}
              onChange={(e) => setArmorClass(parseInt(e.target.value) || 10)}
              className="form-input"
              required
            />
          </div>

          {/* Initiative Modifier */}
          <div className="form-group">
            <label htmlFor="npc-init-mod">Initiative Modifier</label>
            <input
              id="npc-init-mod"
              type="number"
              min="-10"
              max="10"
              value={initiativeModifier}
              onChange={(e) =>
                setInitiativeModifier(parseInt(e.target.value) || 0)
              }
              className="form-input"
              required
            />
            <span className="form-hint">
              Usually same as Dexterity modifier
            </span>
          </div>

          {/* Dexterity Modifier */}
          <div className="form-group">
            <label htmlFor="npc-dex-mod">Dexterity Modifier</label>
            <input
              id="npc-dex-mod"
              type="number"
              min="-10"
              max="10"
              value={dexterityModifier}
              onChange={(e) =>
                setDexterityModifier(parseInt(e.target.value) || 0)
              }
              className="form-input"
              required
            />
            <span className="form-hint">For initiative and DEX saves</span>
          </div>

          {/* Actions */}
          <div className="form-actions">
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary"
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              Add to Combat
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
