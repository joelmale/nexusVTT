/**
 * Quick Character Entry Modal
 * Allows players to create a basic character with minimal info for fast game entry
 * Characters created this way can be enhanced later with full JSON imports
 */

import React, { useState } from 'react';
import { useCharacterStore } from '@/stores/characterStore';

interface QuickCharacterData {
  name: string;
  class: string;
  level: number;
  race: string;
  background: string;
}

interface QuickCharacterEntryProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (characterId: string) => void;
  playerId: string;
}

const DND_CLASSES = [
  'Barbarian',
  'Bard',
  'Cleric',
  'Druid',
  'Fighter',
  'Monk',
  'Paladin',
  'Ranger',
  'Rogue',
  'Sorcerer',
  'Warlock',
  'Wizard',
];

export const QuickCharacterEntry: React.FC<QuickCharacterEntryProps> = ({
  isOpen,
  onClose,
  onComplete,
  playerId,
}) => {
  const [formData, setFormData] = useState<QuickCharacterData>({
    name: '',
    class: '',
    level: 1,
    race: '',
    background: '',
  });
  const [isCreating, setIsCreating] = useState(false);

  const createQuickCharacter = useCharacterStore(
    (state) => state.createQuickCharacter,
  );

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim() || !formData.class) {
      return;
    }

    setIsCreating(true);

    try {
      const characterId = await createQuickCharacter(formData, playerId);
      onComplete(characterId);
      handleClose();
    } catch (error) {
      console.error('Failed to create quick character:', error);
      alert('Failed to create character. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleClose = () => {
    setFormData({
      name: '',
      class: '',
      level: 1,
      race: '',
      background: '',
    });
    onClose();
  };

  const isValid = formData.name.trim() && formData.class;

  return (
    <div
      className="modal-overlay"
      onClick={handleClose}
      style={{
        backgroundColor: 'rgba(0, 0, 0, 0.9)',
        backdropFilter: 'blur(12px)',
      }}
    >
      <div
        className="modal-content quick-entry-modal"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '540px',
          background: 'linear-gradient(135deg, #2d2d3d 0%, #1f1f2e 100%)',
          border: '3px solid rgba(99, 102, 241, 0.6)',
          boxShadow: '0 24px 48px rgba(0, 0, 0, 0.8), 0 0 100px rgba(99, 102, 241, 0.3)',
          borderRadius: '16px',
        }}
      >
        <div
          className="modal-header"
          style={{
            borderBottom: '2px solid rgba(99, 102, 241, 0.2)',
            paddingBottom: '1rem',
            marginBottom: '1.5rem',
          }}
        >
          <h2 style={{
            fontSize: '1.5rem',
            fontWeight: '700',
            background: 'linear-gradient(135deg, #818cf8 0%, #6366f1 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            display: 'inline-block',
          }}>
            ⚡ Quick Character Entry
          </h2>
          <button
            className="modal-close"
            onClick={handleClose}
            style={{
              fontSize: '2rem',
              opacity: 0.7,
              transition: 'opacity 0.2s, transform 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.opacity = '1';
              e.currentTarget.style.transform = 'scale(1.1)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity = '0.7';
              e.currentTarget.style.transform = 'scale(1)';
            }}
          >
            ×
          </button>
        </div>

        <p
          className="modal-subtitle"
          style={{
            marginBottom: '1.5rem',
            color: 'rgba(255, 255, 255, 0.7)',
            fontSize: '0.95rem',
            lineHeight: '1.5',
          }}
        >
          Enter basic info to get started fast. You can import a full character
          JSON later.
        </p>

        <form onSubmit={handleSubmit}>
          {/* Required Fields Section */}
          <div style={{
            marginBottom: '1.5rem',
            padding: '1.25rem',
            background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.2) 0%, rgba(79, 70, 229, 0.15) 100%)',
            borderRadius: '12px',
            border: '2px solid rgba(99, 102, 241, 0.5)',
            boxShadow: '0 4px 12px rgba(99, 102, 241, 0.15)',
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              marginBottom: '1rem',
              color: 'rgba(255, 255, 255, 0.9)',
              fontSize: '0.875rem',
              fontWeight: '600',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}>
              <span style={{ color: '#ef4444' }}>*</span>
              Required Fields
            </div>

            <div className="form-group" style={{ marginBottom: '1rem' }}>
              <label htmlFor="character-name" style={{
                display: 'block',
                marginBottom: '0.5rem',
                fontSize: '0.875rem',
                fontWeight: '500',
                color: 'rgba(255, 255, 255, 0.9)',
              }}>
                Character Name <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                id="character-name"
                type="text"
                placeholder="e.g., Thorin Oakenshield"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                className="glass-input"
                autoFocus
                required
                style={{
                  width: '100%',
                  padding: '0.75rem 1rem',
                  background: 'rgba(20, 20, 30, 0.8)',
                  border: '2px solid rgba(99, 102, 241, 0.6)',
                  borderRadius: '8px',
                  color: '#ffffff',
                  fontSize: '1rem',
                  transition: 'all 0.2s ease',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(129, 140, 248, 0.9)';
                  e.currentTarget.style.background = 'rgba(30, 30, 45, 0.9)';
                  e.currentTarget.style.boxShadow = '0 0 0 3px rgba(99, 102, 241, 0.2)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(99, 102, 241, 0.6)';
                  e.currentTarget.style.background = 'rgba(20, 20, 30, 0.8)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              />
            </div>

            <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label htmlFor="character-class" style={{
                  display: 'block',
                  marginBottom: '0.5rem',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  color: 'rgba(255, 255, 255, 0.9)',
                }}>
                  Class <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <select
                  id="character-class"
                  value={formData.class}
                  onChange={(e) =>
                    setFormData({ ...formData, class: e.target.value })
                  }
                  className="glass-input"
                  required
                  style={{
                    width: '100%',
                    padding: '0.75rem 1rem',
                    background: 'rgba(20, 20, 30, 0.8)',
                    border: '2px solid rgba(99, 102, 241, 0.6)',
                    borderRadius: '8px',
                    color: '#ffffff',
                    fontSize: '1rem',
                    transition: 'all 0.2s ease',
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(129, 140, 248, 0.9)';
                    e.currentTarget.style.background = 'rgba(30, 30, 45, 0.9)';
                    e.currentTarget.style.boxShadow = '0 0 0 3px rgba(99, 102, 241, 0.2)';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(99, 102, 241, 0.6)';
                    e.currentTarget.style.background = 'rgba(20, 20, 30, 0.8)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  <option value="" style={{ background: '#1f1f2e', color: '#ffffff' }}>Select class...</option>
                  {DND_CLASSES.map((cls) => (
                    <option key={cls} value={cls} style={{ background: '#1a1a2e', color: '#ffffff' }}>
                      {cls}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="character-level" style={{
                  display: 'block',
                  marginBottom: '0.5rem',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  color: 'rgba(255, 255, 255, 0.9)',
                }}>
                  Level <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  id="character-level"
                  type="number"
                  min="1"
                  max="20"
                  value={formData.level}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      level: Math.max(1, Math.min(20, parseInt(e.target.value) || 1)),
                    })
                  }
                  className="glass-input"
                  required
                  style={{
                    width: '100%',
                    padding: '0.75rem 1rem',
                    background: 'rgba(20, 20, 30, 0.8)',
                    border: '2px solid rgba(99, 102, 241, 0.6)',
                    borderRadius: '8px',
                    color: '#ffffff',
                    fontSize: '1rem',
                    transition: 'all 0.2s ease',
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(129, 140, 248, 0.9)';
                    e.currentTarget.style.background = 'rgba(30, 30, 45, 0.9)';
                    e.currentTarget.style.boxShadow = '0 0 0 3px rgba(99, 102, 241, 0.2)';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(99, 102, 241, 0.6)';
                    e.currentTarget.style.background = 'rgba(20, 20, 30, 0.8)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                />
              </div>
            </div>
          </div>

          {/* Optional Fields Section */}
          <div style={{
            marginBottom: '1.5rem',
            padding: '1.25rem',
            background: 'rgba(255, 255, 255, 0.08)',
            borderRadius: '12px',
            border: '2px solid rgba(255, 255, 255, 0.25)',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              marginBottom: '1rem',
              color: 'rgba(255, 255, 255, 0.7)',
              fontSize: '0.875rem',
              fontWeight: '600',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}>
              Optional Details
            </div>

            <div className="form-group" style={{ marginBottom: '1rem' }}>
              <label htmlFor="character-race" style={{
                display: 'block',
                marginBottom: '0.5rem',
                fontSize: '0.875rem',
                fontWeight: '500',
                color: 'rgba(255, 255, 255, 0.8)',
              }}>
                Race
              </label>
              <input
                id="character-race"
                type="text"
                placeholder="e.g., Dwarf, Human, Elf..."
                value={formData.race}
                onChange={(e) =>
                  setFormData({ ...formData, race: e.target.value })
                }
                className="glass-input"
                style={{
                  width: '100%',
                  padding: '0.75rem 1rem',
                  background: 'rgba(20, 20, 30, 0.6)',
                  border: '2px solid rgba(255, 255, 255, 0.35)',
                  borderRadius: '8px',
                  color: '#ffffff',
                  fontSize: '1rem',
                  transition: 'all 0.2s ease',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.5)';
                  e.currentTarget.style.background = 'rgba(30, 30, 45, 0.7)';
                  e.currentTarget.style.boxShadow = '0 0 0 3px rgba(255, 255, 255, 0.1)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.35)';
                  e.currentTarget.style.background = 'rgba(20, 20, 30, 0.6)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              />
            </div>

            <div className="form-group">
              <label htmlFor="character-background" style={{
                display: 'block',
                marginBottom: '0.5rem',
                fontSize: '0.875rem',
                fontWeight: '500',
                color: 'rgba(255, 255, 255, 0.8)',
              }}>
                Background
              </label>
              <input
                id="character-background"
                type="text"
                placeholder="e.g., Folk Hero, Sage..."
                value={formData.background}
                onChange={(e) =>
                  setFormData({ ...formData, background: e.target.value })
                }
                className="glass-input"
                style={{
                  width: '100%',
                  padding: '0.75rem 1rem',
                  background: 'rgba(20, 20, 30, 0.6)',
                  border: '2px solid rgba(255, 255, 255, 0.35)',
                  borderRadius: '8px',
                  color: '#ffffff',
                  fontSize: '1rem',
                  transition: 'all 0.2s ease',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.5)';
                  e.currentTarget.style.background = 'rgba(30, 30, 45, 0.7)';
                  e.currentTarget.style.boxShadow = '0 0 0 3px rgba(255, 255, 255, 0.1)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.35)';
                  e.currentTarget.style.background = 'rgba(20, 20, 30, 0.6)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              />
            </div>
          </div>

          {/* Info Box */}
          <div
            className="info-box glass-panel"
            style={{
              padding: '1rem 1.25rem',
              marginBottom: '1.5rem',
              background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.25) 0%, rgba(99, 102, 241, 0.2) 100%)',
              border: '2px solid rgba(99, 102, 241, 0.6)',
              borderRadius: '12px',
              display: 'flex',
              gap: '0.75rem',
              alignItems: 'flex-start',
              boxShadow: '0 4px 12px rgba(59, 130, 246, 0.2)',
            }}
          >
            <div style={{
              fontSize: '1.5rem',
              lineHeight: '1',
              marginTop: '0.125rem',
              flexShrink: 0,
            }}>
              💡
            </div>
            <p style={{
              margin: 0,
              fontSize: '0.9rem',
              lineHeight: '1.5',
              color: 'rgba(255, 255, 255, 0.9)',
            }}>
              <strong style={{ color: '#818cf8' }}>Quick Entry creates a basic placeholder</strong> with
              standard ability scores (10 in all stats). You can import a full
              character JSON later to add complete details, custom stats, and
              equipment.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="modal-actions" style={{
            display: 'flex',
            gap: '0.75rem',
            justifyContent: 'flex-end',
          }}>
            <button
              type="button"
              onClick={handleClose}
              className="glass-button secondary"
              disabled={isCreating}
              style={{
                padding: '0.75rem 1.5rem',
                background: 'rgba(255, 255, 255, 0.1)',
                border: '2px solid rgba(255, 255, 255, 0.3)',
                borderRadius: '8px',
                color: '#ffffff',
                fontSize: '0.95rem',
                fontWeight: '500',
                cursor: isCreating ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s ease',
                opacity: isCreating ? 0.5 : 1,
              }}
              onMouseEnter={(e) => {
                if (!isCreating) {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)';
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.4)';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.3)';
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!isValid || isCreating}
              className="glass-button primary"
              style={{
                padding: '0.75rem 2rem',
                background: isValid && !isCreating
                  ? 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)'
                  : 'rgba(99, 102, 241, 0.3)',
                border: '2px solid rgba(99, 102, 241, 0.8)',
                borderRadius: '8px',
                color: '#ffffff',
                fontSize: '0.95rem',
                fontWeight: '600',
                cursor: (!isValid || isCreating) ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s ease',
                opacity: (!isValid || isCreating) ? 0.6 : 1,
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                boxShadow: isValid && !isCreating
                  ? '0 4px 16px rgba(99, 102, 241, 0.4)'
                  : 'none',
              }}
              onMouseEnter={(e) => {
                if (isValid && !isCreating) {
                  e.currentTarget.style.background = 'linear-gradient(135deg, #818cf8 0%, #6366f1 100%)';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.boxShadow = '0 6px 16px rgba(99, 102, 241, 0.4)';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)';
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(99, 102, 241, 0.3)';
              }}
            >
              {isCreating ? (
                <>
                  <span className="loading-spinner"></span>
                  Creating...
                </>
              ) : (
                <>
                  <span>✨</span>
                  Create & Continue
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
