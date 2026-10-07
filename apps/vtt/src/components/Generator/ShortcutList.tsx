import React, { useState } from 'react';
import Keyboard from 'lucide-react/dist/esm/icons/keyboard';
import ChevronDown from 'lucide-react/dist/esm/icons/chevron-down';
import ChevronUp from 'lucide-react/dist/esm/icons/chevron-up';
import { getShortcutGroups, type GeneratorId } from './generatorActions';
import styles from './GeneratorSidebar.module.css';

/** Collapsible reference of every key the active generator binds. */
export const ShortcutList: React.FC<{ generator: GeneratorId }> = ({
  generator,
}) => {
  const [open, setOpen] = useState(false);
  const groups = getShortcutGroups(generator);
  if (groups.length === 0) return null;

  return (
    <div>
      <button
        type="button"
        className={styles.shortcutToggle}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
          <Keyboard size={13} aria-hidden="true" />
          Keyboard Shortcuts
        </span>
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {open && (
        <div className={styles.shortcutList}>
          <div className={styles.hint}>
            Tip: click the map to give it keyboard focus.
          </div>
          {groups.map((group) => (
            <div key={group.group}>
              <div className={styles.shortcutGroupLabel}>{group.label}</div>
              <div className={styles.shortcutGrid}>
                {group.items.map((item) => (
                  <React.Fragment key={item.id}>
                    <kbd className={styles.kbd}>{item.keyLabel}</kbd>
                    <span className={styles.shortcutDesc}>
                      {item.description}
                    </span>
                  </React.Fragment>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
