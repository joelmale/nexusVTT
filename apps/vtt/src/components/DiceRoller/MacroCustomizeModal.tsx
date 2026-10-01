import React, { useState } from 'react';
import X from 'lucide-react/dist/esm/icons/x';
import type { MacroItem } from './macros';
import styles from './DiceRoller.module.css';

interface MacroCustomizeModalProps {
  macros: MacroItem[];
  enabledIds: string[];
  onToggle: (id: string) => void;
  onAddCustom: (name: string, formula: string) => void;
  onClose: () => void;
}

export const MacroCustomizeModal: React.FC<MacroCustomizeModalProps> = ({
  macros,
  enabledIds,
  onToggle,
  onAddCustom,
  onClose,
}) => {
  const [name, setName] = useState('');
  const [formula, setFormula] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !formula.trim()) return;
    onAddCustom(name.trim(), formula.trim());
    setName('');
    setFormula('');
  };

  return (
    <div
      className={styles.modalOverlay}
      role="dialog"
      aria-label="Customize Macros Modal"
    >
      <div className={styles.modalBox}>
        <div className={styles.modalHeader}>
          <div>
            <h3 className={styles.modalTitle}>Customize Macros</h3>
            <div className={styles.modalSubtitle}>
              Toggle relevant actions for your class and build
            </div>
          </div>
          <button
            type="button"
            className={styles.iconButton}
            onClick={onClose}
            aria-label="Close macro modal"
          >
            <X size={16} />
          </button>
        </div>

        <div className={styles.modalBody}>
          <div className={styles.macroToggleList}>
            {macros.map((macro) => (
              <label key={macro.id} className={styles.macroToggleRow}>
                <span className={styles.macroToggleInfo}>
                  <span className={styles.macroToggleName}>{macro.label}</span>
                  <span className={styles.macroToggleFormula}>
                    {macro.formula}
                  </span>
                </span>
                <input
                  type="checkbox"
                  checked={enabledIds.includes(macro.id)}
                  onChange={() => onToggle(macro.id)}
                  aria-label={`Toggle ${macro.label}`}
                />
              </label>
            ))}
          </div>

          <form onSubmit={handleSubmit} className={styles.customMacroForm}>
            <span className={styles.customMacroHeading}>
              Add Custom Character Macro
            </span>
            <div className={styles.customMacroRow}>
              <input
                type="text"
                className={styles.textInput}
                placeholder="Action name (e.g. Eldritch Smite)"
                value={name}
                onChange={(e) => setName(e.target.value)}
                aria-label="New macro action name"
              />
              <input
                type="text"
                className={styles.textInput}
                placeholder="Formula (e.g. 2d8+4)"
                value={formula}
                onChange={(e) => setFormula(e.target.value)}
                aria-label="New macro formula"
              />
              <button
                type="submit"
                className={styles.primaryButton}
                disabled={!name.trim() || !formula.trim()}
              >
                Add
              </button>
            </div>
          </form>
        </div>

        <div className={styles.modalFooter}>
          <button
            type="button"
            className={styles.primaryButton}
            onClick={onClose}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
