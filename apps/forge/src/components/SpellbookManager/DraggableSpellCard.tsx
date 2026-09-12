import React, { useState } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { GripVertical, Plus, Star, Wand2 } from 'lucide-react';
import { AppSpell } from '../../services/dataService';
import { SpellbookEntry } from '../../services/storage/IStorageService';
import { schoolIcons, schoolColors } from '../../utils/spellbookAdapter';

interface DraggableSpellCardProps {
  spell: AppSpell;
  spellbooks?: SpellbookEntry[];
  isFavorite?: boolean;
  onAddToSpellbook?: (spellbookId: string, spellSlug: string) => void;
  onToggleFavorite?: (spellSlug: string) => void;
  onSelectSpell?: (spell: AppSpell) => void;
}

export const DraggableSpellCard: React.FC<DraggableSpellCardProps> = ({
  spell,
  spellbooks = [],
  isFavorite = false,
  onAddToSpellbook,
  onToggleFavorite,
  onSelectSpell,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: spell.slug,
  });

  const schoolKey = spell.school.toLowerCase();
  const Icon = schoolIcons[schoolKey] || Wand2;
  const colorClass = schoolColors[schoolKey] || 'bg-theme-secondary border-theme-tertiary text-theme-primary';

  const levelLabel = spell.level === 0 ? 'Cantrip' : `Level ${spell.level}`;

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={{ touchAction: 'none' }}
      className={`group relative rounded-lg border p-3 transition-all cursor-grab active:cursor-grabbing select-none ${colorClass} ${
        isDragging ? 'opacity-30 border-dashed' : 'hover:shadow-md hover:border-accent-blue-light/50'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        {/* Drag handle icon */}
        <div
          className="p-1 text-theme-muted group-hover:text-accent-blue-light transition-colors"
          title="Drag to add to spellbook"
        >
          <GripVertical className="w-4 h-4" />
        </div>

        {/* Title & basic metadata */}
        <div
          className="flex-1 cursor-pointer"
          onClick={() => onSelectSpell?.(spell)}
        >
          <div className="flex items-center gap-2">
            <Icon className="w-4 h-4 shrink-0" />
            <h4 className="font-bold text-sm text-white group-hover:text-accent-blue-light transition-colors line-clamp-1">
              {spell.name}
            </h4>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 mt-1 text-[11px] text-theme-muted">
            <span className="font-semibold text-theme-primary">{levelLabel}</span>
            <span>•</span>
            <span className="capitalize">{spell.school}</span>
            {spell.ritual && (
              <span className="px-1.5 py-0.2 bg-purple-900/60 text-purple-300 rounded text-[10px] border border-purple-700">
                Ritual
              </span>
            )}
            {spell.concentration && (
              <span className="px-1.5 py-0.2 bg-amber-900/60 text-amber-300 rounded text-[10px] border border-amber-700">
                Conc.
              </span>
            )}
          </div>
        </div>

        {/* Favorite & Quick Add menu */}
        <div className="flex items-center gap-1">
          {onToggleFavorite && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleFavorite(spell.slug);
              }}
              className={`p-1 rounded hover:bg-theme-primary/40 transition-colors ${
                isFavorite ? 'text-yellow-400' : 'text-theme-muted hover:text-yellow-300'
              }`}
              title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
            >
              <Star className="w-3.5 h-3.5 fill-current" />
            </button>
          )}

          {spellbooks.length > 0 && onAddToSpellbook && (
            <div className="relative">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen(!menuOpen);
                }}
                className="p-1 rounded text-theme-muted hover:text-white hover:bg-theme-primary/40 transition-colors"
                title="Add to spellbook"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>

              {menuOpen && (
                <div
                  className="absolute right-0 top-full mt-1 w-48 bg-theme-secondary border border-theme-primary rounded-lg shadow-xl z-50 py-1"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="px-3 py-1 text-[10px] font-semibold text-theme-muted border-b border-theme-primary/40">
                    ADD TO SPELLBOOK
                  </div>
                  {spellbooks.map((sb) => {
                    const alreadyIn = sb.spells.includes(spell.slug);
                    return (
                      <button
                        key={sb.id}
                        type="button"
                        disabled={alreadyIn}
                        onClick={() => {
                          onAddToSpellbook(sb.id, spell.slug);
                          setMenuOpen(false);
                        }}
                        className={`w-full text-left px-3 py-1.5 text-xs truncate hover:bg-theme-tertiary transition-colors flex items-center justify-between ${
                          alreadyIn ? 'text-theme-muted opacity-60' : 'text-theme-primary'
                        }`}
                      >
                        <span className="truncate">{sb.name}</span>
                        {alreadyIn && <span className="text-[10px] text-green-400">In book</span>}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
