import React from 'react';
import { Search, RotateCcw } from 'lucide-react';
import { SpellFilterState } from '../../utils/spellbookAdapter';

interface SpellFilterBarProps {
  filters: SpellFilterState;
  onChangeFilters: (updated: Partial<SpellFilterState>) => void;
  onResetFilters: () => void;
  availableSchools: string[];
}

export const SpellFilterBar: React.FC<SpellFilterBarProps> = ({
  filters,
  onChangeFilters,
  onResetFilters,
  availableSchools,
}) => {
  const hasActiveFilters =
    filters.selectedLevel !== 'all' ||
    filters.selectedSchools.length > 0 ||
    filters.filterRitual ||
    filters.filterConcentration ||
    filters.filterFavorites;

  const toggleSchool = (school: string) => {
    const current = filters.selectedSchools;
    const next = current.includes(school)
      ? current.filter((s) => s !== school)
      : [...current, school];
    onChangeFilters({ selectedSchools: next });
  };

  return (
    <div className="bg-theme-secondary/80 rounded-xl p-4 border border-theme-primary/40 space-y-3">
      {/* Top row: Search input & Edition toggle */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-theme-muted" />
          <input
            type="text"
            value={filters.searchTerm}
            onChange={(e) => onChangeFilters({ searchTerm: e.target.value })}
            placeholder="Search spells by name, school, or class..."
            className="w-full pl-9 pr-3 py-2 bg-theme-primary/60 border border-theme-tertiary/40 rounded-lg text-sm text-theme-primary placeholder-theme-muted focus:outline-none focus:border-accent-blue-light"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <span className="text-xs text-theme-muted font-medium">Edition:</span>
          <div className="flex bg-theme-primary/60 p-1 rounded-lg border border-theme-tertiary/40 text-xs">
            {(['all', '2014', '2024'] as const).map((ed) => (
              <button
                key={ed}
                type="button"
                onClick={() => onChangeFilters({ editionFilter: ed })}
                className={`px-3 py-1 rounded-md font-semibold transition-colors ${
                  filters.editionFilter === ed
                    ? 'bg-accent-blue-dark text-white shadow'
                    : 'text-theme-muted hover:text-white'
                }`}
              >
                {ed === 'all' ? 'All' : ed}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Second row: Level select & Toggles */}
      <div className="flex flex-wrap items-center gap-3 text-xs">
        <div className="flex items-center gap-1.5">
          <span className="text-theme-muted font-medium">Level:</span>
          <select
            value={filters.selectedLevel}
            onChange={(e) => onChangeFilters({ selectedLevel: e.target.value })}
            className="bg-theme-primary/60 border border-theme-tertiary/40 rounded-md px-2 py-1 text-theme-primary focus:outline-none"
          >
            <option value="all">All Levels</option>
            <option value="0">Cantrip</option>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((lvl) => (
              <option key={lvl} value={lvl.toString()}>
                Level {lvl}
              </option>
            ))}
          </select>
        </div>

        <div className="h-4 w-px bg-theme-tertiary/40 hidden sm:block" />

        <button
          type="button"
          onClick={() => onChangeFilters({ filterRitual: !filters.filterRitual })}
          className={`px-2.5 py-1 rounded-md border text-xs font-semibold transition-colors ${
            filters.filterRitual
              ? 'bg-purple-900/50 text-purple-300 border-purple-600'
              : 'bg-theme-primary/40 text-theme-muted border-theme-tertiary/30 hover:border-purple-600/50'
          }`}
        >
          Ritual
        </button>

        <button
          type="button"
          onClick={() =>
            onChangeFilters({ filterConcentration: !filters.filterConcentration })
          }
          className={`px-2.5 py-1 rounded-md border text-xs font-semibold transition-colors ${
            filters.filterConcentration
              ? 'bg-amber-900/50 text-amber-300 border-amber-600'
              : 'bg-theme-primary/40 text-theme-muted border-theme-tertiary/30 hover:border-amber-600/50'
          }`}
        >
          Concentration
        </button>

        <button
          type="button"
          onClick={() => onChangeFilters({ filterFavorites: !filters.filterFavorites })}
          className={`px-2.5 py-1 rounded-md border text-xs font-semibold transition-colors ${
            filters.filterFavorites
              ? 'bg-yellow-900/50 text-yellow-300 border-yellow-600'
              : 'bg-theme-primary/40 text-theme-muted border-theme-tertiary/30 hover:border-yellow-600/50'
          }`}
        >
          ⭐ Favorites
        </button>

        {hasActiveFilters && (
          <button
            type="button"
            onClick={onResetFilters}
            className="flex items-center gap-1 text-xs text-accent-red-light hover:underline ml-auto"
          >
            <RotateCcw className="w-3 h-3" /> Reset
          </button>
        )}
      </div>

      {/* Third row: School tags */}
      <div className="flex flex-wrap gap-1.5 pt-1">
        {availableSchools.map((school) => {
          const isSelected = filters.selectedSchools.includes(school.toLowerCase());
          return (
            <button
              key={school}
              type="button"
              onClick={() => toggleSchool(school.toLowerCase())}
              className={`px-2 py-0.5 rounded-full text-[11px] font-medium border capitalize transition-colors ${
                isSelected
                  ? 'bg-accent-blue-dark/80 text-white border-accent-blue-light'
                  : 'bg-theme-primary/30 text-theme-muted border-theme-tertiary/20 hover:border-theme-tertiary'
              }`}
            >
              {school}
            </button>
          );
        })}
      </div>
    </div>
  );
};
