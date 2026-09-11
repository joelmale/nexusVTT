import React, { useMemo, useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { BookOpen, Check, Trash2, Scroll } from 'lucide-react';
import { AppSpell } from '../../services/dataService';
import { SpellbookEntry } from '../../services/storage/IStorageService';

interface DroppableSpellbookProps {
  spellbook: SpellbookEntry;
  allSpells: AppSpell[];
  sessionMode?: boolean;
  onUpdateSpellbook: (updated: SpellbookEntry) => void;
  onDeleteSpellbook: (id: string) => void;
  onSelectSpell?: (spell: AppSpell) => void;
}

export const DroppableSpellbook: React.FC<DroppableSpellbookProps> = ({
  spellbook,
  allSpells,
  sessionMode = false,
  onUpdateSpellbook,
  onDeleteSpellbook,
  onSelectSpell,
}) => {
  const { setNodeRef, isOver } = useDroppable({
    id: spellbook.id,
  });

  const [filterLevel, setFilterLevel] = useState<'all' | string>('all');
  const [filterPrepared, setFilterPrepared] = useState<'all' | 'prepared' | 'known'>('all');

  const spellMap = useMemo(() => {
    const map = new Map<string, AppSpell>();
    allSpells.forEach((s) => map.set(s.slug, s));
    return map;
  }, [allSpells]);

  const spellsInBook = useMemo(() => {
    return spellbook.spells
      .map((slug) => spellMap.get(slug))
      .filter((s): s is AppSpell => Boolean(s));
  }, [spellbook.spells, spellMap]);

  const preparedSet = useMemo(
    () => new Set(spellbook.preparedSpells || []),
    [spellbook.preparedSpells]
  );

  const visibleSpells = useMemo(() => {
    const activePrepFilter = sessionMode ? 'prepared' : filterPrepared;
    return spellsInBook.filter((spell) => {
      if (filterLevel !== 'all' && spell.level !== Number(filterLevel)) {
        return false;
      }
      if (activePrepFilter === 'prepared' && !preparedSet.has(spell.slug)) {
        return false;
      }
      if (activePrepFilter === 'known' && preparedSet.has(spell.slug)) {
        return false;
      }
      return true;
    });
  }, [spellsInBook, filterLevel, filterPrepared, preparedSet, sessionMode]);

  const togglePrepared = (spellSlug: string) => {
    const nextPrepared = preparedSet.has(spellSlug)
      ? spellbook.preparedSpells.filter((slug) => slug !== spellSlug)
      : [...(spellbook.preparedSpells || []), spellSlug];

    onUpdateSpellbook({
      ...spellbook,
      preparedSpells: nextPrepared,
      updatedAt: Date.now(),
    });
  };

  const removeSpellFromBook = (spellSlug: string) => {
    const nextSpells = spellbook.spells.filter((slug) => slug !== spellSlug);
    const nextPrepared = (spellbook.preparedSpells || []).filter(
      (slug) => slug !== spellSlug
    );

    onUpdateSpellbook({
      ...spellbook,
      spells: nextSpells,
      preparedSpells: nextPrepared,
      updatedAt: Date.now(),
    });
  };

  return (
    <div
      ref={setNodeRef}
      className={`rounded-xl border transition-all ${
        isOver
          ? 'border-accent-blue-light bg-accent-blue-dark/20 shadow-xl'
          : 'border-theme-secondary/80 bg-theme-secondary/50'
      }`}
    >
      {/* Header */}
      <div className="p-4 border-b border-theme-tertiary/40 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <BookOpen className="w-5 h-5 text-accent-blue-light shrink-0" />
          <div>
            <h3 className="font-bold text-white text-base leading-tight">
              {spellbook.name}
            </h3>
            {spellbook.description && (
              <p className="text-xs text-theme-muted line-clamp-1">
                {spellbook.description}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-accent-blue-dark/40 text-accent-blue-light border border-accent-blue-light/30">
            {preparedSet.size} / {spellsInBook.length} Prepared
          </span>

          <button
            type="button"
            onClick={() => onDeleteSpellbook(spellbook.id)}
            className="p-1.5 text-theme-muted hover:text-accent-red-light rounded hover:bg-theme-tertiary transition-colors"
            title="Delete Spellbook"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Filter controls inside spellbook */}
      <div className="px-4 py-2 bg-theme-primary/30 border-b border-theme-tertiary/20 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2">
          <span className="text-theme-muted">Level:</span>
          <select
            value={filterLevel}
            onChange={(e) => setFilterLevel(e.target.value)}
            className="bg-theme-primary/60 border border-theme-tertiary/40 rounded px-1.5 py-0.5 text-theme-primary focus:outline-none"
          >
            <option value="all">All</option>
            <option value="0">Cantrips</option>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((lvl) => (
              <option key={lvl} value={lvl.toString()}>
                Level {lvl}
              </option>
            ))}
          </select>
        </div>

        {!sessionMode && (
          <div className="flex bg-theme-primary/60 p-0.5 rounded border border-theme-tertiary/30 text-[11px]">
            {(['all', 'prepared', 'known'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setFilterPrepared(mode)}
                className={`px-2 py-0.5 rounded capitalize ${
                  filterPrepared === mode
                    ? 'bg-accent-blue-dark text-white font-medium'
                    : 'text-theme-muted hover:text-white'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Spells List inside book */}
      <div className="p-3 min-h-[160px] max-h-[420px] overflow-y-auto space-y-2">
        {visibleSpells.length === 0 ? (
          <div className="h-32 flex flex-col items-center justify-center text-center p-4 border-2 border-dashed border-theme-tertiary/30 rounded-lg text-theme-muted">
            <Scroll className="w-8 h-8 mb-2 opacity-50 text-accent-blue-light" />
            <p className="text-xs font-medium">
              {spellsInBook.length === 0
                ? 'Drag spells here to add them to your spellbook'
                : 'No spells match your current filter'}
            </p>
          </div>
        ) : (
          visibleSpells.map((spell) => {
            const isPrepared = preparedSet.has(spell.slug);
            return (
              <div
                key={spell.slug}
                className={`flex items-center justify-between p-2.5 rounded-lg border transition-colors ${
                  isPrepared
                    ? 'bg-accent-blue-dark/20 border-accent-blue-light/50'
                    : 'bg-theme-primary/40 border-theme-tertiary/30'
                }`}
              >
                <div
                  className="flex-1 cursor-pointer"
                  onClick={() => onSelectSpell?.(spell)}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs text-white hover:text-accent-blue-light transition-colors">
                      {spell.name}
                    </span>
                    <span className="text-[10px] text-theme-muted">
                      {spell.level === 0 ? 'Cantrip' : `Lvl ${spell.level}`} • {spell.school}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => togglePrepared(spell.slug)}
                    className={`px-2 py-1 rounded text-xs font-medium flex items-center gap-1 transition-colors ${
                      isPrepared
                        ? 'bg-accent-blue-dark text-white border border-accent-blue-light'
                        : 'bg-theme-tertiary/50 text-theme-muted hover:text-white'
                    }`}
                    title={isPrepared ? 'Unprepare spell' : 'Prepare spell'}
                  >
                    <Check className={`w-3 h-3 ${isPrepared ? 'opacity-100' : 'opacity-30'}`} />
                    {isPrepared ? 'Prepared' : 'Prepare'}
                  </button>

                  <button
                    type="button"
                    onClick={() => removeSpellFromBook(spell.slug)}
                    className="p-1 text-theme-muted hover:text-accent-red-light rounded hover:bg-theme-tertiary transition-colors"
                    title="Remove spell"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
