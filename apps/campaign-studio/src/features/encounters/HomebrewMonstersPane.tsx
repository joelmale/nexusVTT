import { useMemo, useState } from 'react';
import Copy from 'lucide-react/dist/esm/icons/copy';
import Edit3 from 'lucide-react/dist/esm/icons/edit-3';
import Plus from 'lucide-react/dist/esm/icons/plus';
import Trash2 from 'lucide-react/dist/esm/icons/trash-2';

import type { HomebrewMonster } from '@/demo/fixture-registry';
import { useSectionBundle } from '@/features/section-shell/SectionContext';
import { HomebrewMonsterModal } from './HomebrewMonsterModal';
import styles from './HomebrewMonstersPane.module.css';
import {
  ABILITY_NAMES,
  CR_OPTIONS,
  cloneMonsterDraft,
  filterHomebrewMonsters,
  formatModifier,
  MONSTER_TYPES,
  xpForCr,
} from './homebrewModel';

export function HomebrewMonstersPane() {
  const { bundle, store } = useSectionBundle();
  const monsters = useMemo(
    () => bundle.homebrewMonsters ?? [],
    [bundle.homebrewMonsters],
  );

  const [search, setSearch] = useState('');
  const [selectedType, setSelectedType] = useState('all');
  const [selectedCr, setSelectedCr] = useState('all');

  const [modalOpen, setModalOpen] = useState(false);
  const [editingMonster, setEditingMonster] = useState<Partial<HomebrewMonster> | undefined>();

  const filtered = useMemo(
    () =>
      filterHomebrewMonsters(monsters, {
        query: search,
        type: selectedType,
        cr: selectedCr,
      }),
    [monsters, search, selectedType, selectedCr],
  );

  const handleOpenAuthor = () => {
    setEditingMonster(undefined);
    setModalOpen(true);
  };

  const handleEdit = (monster: HomebrewMonster) => {
    setEditingMonster(monster);
    setModalOpen(true);
  };

  const handleDuplicate = (monster: HomebrewMonster) => {
    const cloned = cloneMonsterDraft(monster);
    setEditingMonster(cloned);
    setModalOpen(true);
  };

  const handleDelete = async (monster: HomebrewMonster) => {
    if (!window.confirm(`Delete custom monster "${monster.name}"?`)) return;
    await store.removeItem('homebrew-monster', monster.id);
  };

  return (
    <div className={styles.pane}>
      <div className={styles.actionBar}>
        <div className={styles.filters}>
          <input
            aria-label="Search homebrew monsters"
            className={styles.searchInput}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, type, or notes…"
            type="search"
            value={search}
          />
          <select
            aria-label="Filter by creature type"
            className={styles.selectFilter}
            onChange={(e) => setSelectedType(e.target.value)}
            value={selectedType}
          >
            <option value="all">All Types</option>
            {MONSTER_TYPES.map((t) => (
              <option key={t} value={t}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </option>
            ))}
          </select>
          <select
            aria-label="Filter by challenge rating"
            className={styles.selectFilter}
            onChange={(e) => setSelectedCr(e.target.value)}
            value={selectedCr}
          >
            <option value="all">All CRs</option>
            {CR_OPTIONS.map((cr) => (
              <option key={cr} value={cr}>
                CR {cr}
              </option>
            ))}
          </select>
        </div>

        {store.editable ? (
          <button
            aria-label="Author creature"
            className={styles.authorButton}
            onClick={handleOpenAuthor}
            type="button"
          >
            <Plus size={16} />
            <span>Author Creature</span>
          </button>
        ) : null}
      </div>

      {filtered.length === 0 ? (
        <div className={styles.emptyState}>
          <h3 className={styles.emptyTitle}>
            {monsters.length === 0
              ? 'No homebrew creatures authored yet.'
              : 'No custom creatures match your filters.'}
          </h3>
          <p>
            {monsters.length === 0
              ? 'Create custom creature statblocks directly in your campaign to use in encounters.'
              : 'Try clearing your search query or changing filter options.'}
          </p>
          {store.editable && monsters.length === 0 ? (
            <button
              className={styles.authorButton}
              onClick={handleOpenAuthor}
              type="button"
            >
              <Plus size={16} />
              <span>Author First Creature</span>
            </button>
          ) : null}
        </div>
      ) : (
        <div className={styles.grid}>
          {filtered.map((m) => {
            const xp = xpForCr(m.cr);
            return (
              <article aria-label={m.name} className={styles.card} key={m.id}>
                <header className={styles.cardHeader}>
                  <div className={styles.cardTitleGroup}>
                    <h3 className={styles.cardTitle}>{m.name}</h3>
                    <span className={styles.cardMeta}>
                      {m.size} {m.type} · {m.edition} Rules
                    </span>
                  </div>
                  <span className={styles.crBadge}>
                    CR {m.cr} {xp > 0 ? `(${xp.toLocaleString()} XP)` : ''}
                  </span>
                </header>

                <div className={styles.statRibbon}>
                  <span>
                    <strong>AC</strong> {m.ac}
                  </span>
                  <span>
                    <strong>HP</strong> {m.hp}
                  </span>
                  <span>
                    <strong>Speed</strong> {m.speed} ft
                  </span>
                </div>

                <div className={styles.abilities}>
                  {ABILITY_NAMES.map((name, idx) => {
                    const score = m.abilities[idx] ?? 10;
                    return (
                      <div className={styles.abilityCell} key={name}>
                        <span className={styles.abilityCellLabel}>{name}</span>
                        <span className={styles.abilityCellVal}>
                          {score} ({formatModifier(score)})
                        </span>
                      </div>
                    );
                  })}
                </div>

                {m.notes ? <div className={styles.notes}>{m.notes}</div> : null}

                {store.editable ? (
                  <footer className={styles.cardActions}>
                    <button
                      aria-label={`Duplicate ${m.name}`}
                      className={styles.actionButton}
                      onClick={() => handleDuplicate(m)}
                      title="Duplicate & customise"
                      type="button"
                    >
                      <Copy size={14} />
                      <span>Duplicate</span>
                    </button>
                    <button
                      aria-label={`Edit ${m.name}`}
                      className={styles.actionButton}
                      onClick={() => handleEdit(m)}
                      title="Edit stat block"
                      type="button"
                    >
                      <Edit3 size={14} />
                      <span>Edit</span>
                    </button>
                    <button
                      aria-label={`Delete ${m.name}`}
                      className={`${styles.actionButton} ${styles.deleteButton}`}
                      onClick={() => void handleDelete(m)}
                      title="Delete creature"
                      type="button"
                    >
                      <Trash2 size={14} />
                      <span>Delete</span>
                    </button>
                  </footer>
                ) : null}
              </article>
            );
          })}
        </div>
      )}

      <HomebrewMonsterModal
        initialMonster={editingMonster}
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditingMonster(undefined);
        }}
      />
    </div>
  );
}
