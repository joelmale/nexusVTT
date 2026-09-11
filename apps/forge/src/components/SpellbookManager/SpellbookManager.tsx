import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  useSensor,
  useSensors,
  PointerSensor,
  pointerWithin,
} from '@dnd-kit/core';
import { Plus, BookOpen, Download, Upload, Sparkles } from 'lucide-react';
import { SPELL_DATABASE, AppSpell } from '../../services/dataService';
import { SpellbookEntry } from '../../services/storage/IStorageService';
import {
  getAllSpellbooks,
  addSpellbook,
  updateSpellbook,
  deleteSpellbook,
} from '../../services/dbService';
import { SpellFilterBar } from './SpellFilterBar';
import { DraggableSpellCard } from './DraggableSpellCard';
import { DroppableSpellbook } from './DroppableSpellbook';
import { CreateSpellbookModal } from './CreateSpellbookModal';
import { SpellDetailModal } from '../SpellDetailModal';
import { SpellFilterState, filterAppSpells, schoolColors } from '../../utils/spellbookAdapter';
import { migrateLegacySpellbooks } from '../../utils/spellbookMigration';
import { log } from '../../utils/logger';
import { Character } from '../../types/dnd';

interface SpellbookManagerProps {
  selectedCharacter?: Character | null;
}

export const SpellbookManager: React.FC<SpellbookManagerProps> = ({ selectedCharacter }) => {
  const [spellbooks, setSpellbooks] = useState<SpellbookEntry[]>([]);
  const [selectedSpell, setSelectedSpell] = useState<AppSpell | null>(null);
  const [activeDragSpell, setActiveDragSpell] = useState<AppSpell | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    })
  );
  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem('spellbook-favorites');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const [sessionMode, setSessionMode] = useState(false);
  const [filters, setFilters] = useState<Omit<SpellFilterState, 'favoriteSlugs'>>({
    searchTerm: '',
    editionFilter: '2024',
    selectedLevel: 'all',
    selectedSchools: [],
    filterRitual: false,
    filterConcentration: false,
    filterFavorites: false,
  });

  // Load initial spellbooks from dbService (after checking legacy migration)
  const refreshSpellbooks = useCallback(async () => {
    try {
      await migrateLegacySpellbooks();
      const books = await getAllSpellbooks();
      setSpellbooks(books);
    } catch (err) {
      log.error('Failed to load spellbooks:', { error: err });
    }
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        await migrateLegacySpellbooks();
        const books = await getAllSpellbooks();
        if (active) {
          setSpellbooks(books);
        }
      } catch (err) {
        log.error('Failed to load spellbooks on mount:', { error: err });
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  // Toggle favorite helper
  const handleToggleFavorite = (spellSlug: string) => {
    setFavorites((prev) => {
      const next = prev.includes(spellSlug)
        ? prev.filter((s) => s !== spellSlug)
        : [...prev, spellSlug];
      try {
        localStorage.setItem('spellbook-favorites', JSON.stringify(next));
      } catch (err) {
        log.error('Failed to save favorites:', { error: err });
      }
      return next;
    });
  };

  // Filter updates
  const handleUpdateFilters = (updated: Partial<SpellFilterState>) => {
    setFilters((prev) => ({ ...prev, ...updated }));
  };

  const handleResetFilters = () => {
    setFilters({
      searchTerm: '',
      editionFilter: '2024',
      selectedLevel: 'all',
      selectedSchools: [],
      filterRitual: false,
      filterConcentration: false,
      filterFavorites: false,
    });
  };

  // Available schools for filter bar
  const availableSchools = useMemo(() => {
    const schools = Array.from(new Set(SPELL_DATABASE.map((s) => s.school)));
    return schools.sort();
  }, []);

  // Combined filter state for search/filtering
  const fullFilterState = useMemo<SpellFilterState>(
    () => ({ ...filters, favoriteSlugs: favorites }),
    [filters, favorites]
  );

  // Filtered spells for left panel
  const filteredSpells = useMemo(() => {
    return filterAppSpells(SPELL_DATABASE, fullFilterState);
  }, [fullFilterState]);

  // Add spell to spellbook
  const handleAddSpellToSpellbook = async (spellbookId: string, spellSlug: string) => {
    const targetBook = spellbooks.find((b) => b.id === spellbookId);
    if (!targetBook) return;

    if (targetBook.spells.includes(spellSlug)) return;

    const updated: SpellbookEntry = {
      ...targetBook,
      spells: [...targetBook.spells, spellSlug],
      updatedAt: Date.now(),
    };

    await updateSpellbook(updated);
    setSpellbooks((prev) => prev.map((b) => (b.id === spellbookId ? updated : b)));
  };

  // Drag handlers
  const handleDragStart = (event: DragStartEvent) => {
    const spell = SPELL_DATABASE.find((s) => s.slug === event.active.id);
    if (spell) {
      setActiveDragSpell(spell);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      handleAddSpellToSpellbook(over.id as string, active.id as string);
    }
    setActiveDragSpell(null);
  };

  // Create new spellbook
  const handleCreateSpellbook = async (newBook: SpellbookEntry) => {
    await addSpellbook(newBook);
    setSpellbooks((prev) => [...prev, newBook]);
  };

  // Update spellbook
  const handleSaveSpellbook = async (updated: SpellbookEntry) => {
    await updateSpellbook(updated);
    setSpellbooks((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
  };

  // Delete spellbook
  const handleDeleteSpellbook = async (id: string) => {
    await deleteSpellbook(id);
    setSpellbooks((prev) => prev.filter((b) => b.id !== id));
  };

  // Export data
  const handleExportData = () => {
    const exportData = {
      spellbooks,
      favorites,
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nexus-forge-spellbooks-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Import data
  const handleImportData = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const content = e.target?.result as string;
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed.spellbooks)) {
          for (const book of parsed.spellbooks) {
            await addSpellbook(book);
          }
          await refreshSpellbooks();
        }
        if (Array.isArray(parsed.favorites)) {
          setFavorites(parsed.favorites);
          localStorage.setItem('spellbook-favorites', JSON.stringify(parsed.favorites));
        }
      } catch (err) {
        log.error('Failed to import spellbooks:', { error: err });
      }
    };
    reader.readAsText(file);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="space-y-6">
        {/* Top Header & Actions */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-theme-secondary/80 p-4 rounded-xl border border-theme-primary/40">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-accent-blue-dark/30 border border-accent-blue-light/40 rounded-xl text-accent-blue-light">
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Spellbook Manager</h2>
              <p className="text-xs text-theme-muted">
                {selectedCharacter
                  ? `Managing spell collection for ${selectedCharacter.name}`
                  : 'Drag spells into spellbooks to prepare for your adventures'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setSessionMode(!sessionMode)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border flex items-center gap-1.5 transition-colors ${
                sessionMode
                  ? 'bg-purple-900/60 border-purple-600 text-purple-200'
                  : 'bg-theme-primary/60 border-theme-tertiary/40 text-theme-muted hover:text-white'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              {sessionMode ? 'Session View (Prepared Only)' : 'Session Mode'}
            </button>

            <button
              type="button"
              onClick={handleExportData}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-theme-primary/60 border border-theme-tertiary/40 text-theme-muted hover:text-white transition-colors flex items-center gap-1.5"
              title="Export spellbooks to JSON"
            >
              <Download className="w-3.5 h-3.5" /> Export
            </button>

            <label
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-theme-primary/60 border border-theme-tertiary/40 text-theme-muted hover:text-white transition-colors cursor-pointer flex items-center gap-1.5"
              title="Import spellbooks from JSON"
            >
              <Upload className="w-3.5 h-3.5" /> Import
              <input
                type="file"
                accept=".json"
                onChange={handleImportData}
                className="hidden"
              />
            </label>

            <button
              type="button"
              onClick={() => setIsCreateModalOpen(true)}
              className="px-4 py-1.5 rounded-lg text-xs font-bold bg-accent-blue-dark hover:bg-accent-blue-dark/80 text-white transition-colors flex items-center gap-1.5 shadow"
            >
              <Plus className="w-4 h-4" /> New Spellbook
            </button>
          </div>
        </div>

        {/* Filter Controls */}
        <SpellFilterBar
          filters={filters}
          onChangeFilters={handleUpdateFilters}
          onResetFilters={handleResetFilters}
          availableSchools={availableSchools}
        />

        {/* Main 2-column Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Available Spells (5 cols) */}
          <div className="lg:col-span-5 space-y-3">
            <div className="flex items-center justify-between px-1">
              <h3 className="font-bold text-sm text-theme-primary uppercase tracking-wider">
                Spell Library ({filteredSpells.length})
              </h3>
              <span className="text-xs text-theme-muted">Drag to add</span>
            </div>

            <div className="space-y-2 max-h-[700px] overflow-y-auto pr-1">
              {filteredSpells.length === 0 ? (
                <div className="p-8 text-center bg-theme-secondary/40 border border-theme-tertiary/20 rounded-xl text-theme-muted text-sm">
                  No spells match your active search and filters.
                </div>
              ) : (
                filteredSpells.map((spell) => (
                  <DraggableSpellCard
                    key={spell.slug}
                    spell={spell}
                    spellbooks={spellbooks}
                    isFavorite={favorites.includes(spell.slug)}
                    onAddToSpellbook={handleAddSpellToSpellbook}
                    onToggleFavorite={handleToggleFavorite}
                    onSelectSpell={setSelectedSpell}
                  />
                ))
              )}
            </div>
          </div>

          {/* Right Column: Spellbooks (7 cols) */}
          <div className="lg:col-span-7 space-y-4">
            <div className="flex items-center justify-between px-1">
              <h3 className="font-bold text-sm text-theme-primary uppercase tracking-wider">
                My Spellbooks ({spellbooks.length})
              </h3>
            </div>

            {spellbooks.length === 0 ? (
              <div className="p-12 text-center bg-theme-secondary/40 border-2 border-dashed border-theme-tertiary/30 rounded-xl space-y-3">
                <BookOpen className="w-12 h-12 text-accent-blue-light/50 mx-auto" />
                <h4 className="font-bold text-white text-base">No Spellbooks Yet</h4>
                <p className="text-xs text-theme-muted max-w-sm mx-auto">
                  Create your first spellbook to organize cantrips, prepare daily spells, and build customized spell lists.
                </p>
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(true)}
                  className="px-4 py-2 rounded-lg text-xs font-bold bg-accent-blue-dark hover:bg-accent-blue-dark/80 text-white transition-colors inline-flex items-center gap-1.5 shadow"
                >
                  <Plus className="w-4 h-4" /> Create Spellbook
                </button>
              </div>
            ) : (
              <div className="space-y-4 max-h-[700px] overflow-y-auto pr-1">
                {spellbooks.map((book) => (
                  <DroppableSpellbook
                    key={book.id}
                    spellbook={book}
                    allSpells={SPELL_DATABASE}
                    sessionMode={sessionMode}
                    onUpdateSpellbook={handleSaveSpellbook}
                    onDeleteSpellbook={handleDeleteSpellbook}
                    onSelectSpell={setSelectedSpell}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Create Modal */}
      <CreateSpellbookModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreate={handleCreateSpellbook}
        characterId={selectedCharacter?.id}
      />

      {/* Spell Detail Modal */}
      <SpellDetailModal
        spell={selectedSpell}
        isOpen={Boolean(selectedSpell)}
        onClose={() => setSelectedSpell(null)}
      />

      {/* Drag Overlay for floating card preview */}
      <DragOverlay>
        {activeDragSpell ? (
          <div
            className={`p-3 rounded-lg border shadow-2xl scale-105 pointer-events-none ${
              schoolColors[activeDragSpell.school.toLowerCase()] ||
              'bg-theme-secondary border-theme-tertiary text-white'
            }`}
          >
            <div className="flex items-center gap-2 font-bold text-sm text-white">
              <span>{activeDragSpell.name}</span>
              <span className="text-xs text-theme-muted font-normal">
                ({activeDragSpell.level === 0 ? 'Cantrip' : `Lvl ${activeDragSpell.level}`})
              </span>
            </div>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
};
