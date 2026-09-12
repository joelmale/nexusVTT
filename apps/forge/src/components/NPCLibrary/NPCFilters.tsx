import React from 'react';
import { NPCFilters as NPCFiltersType } from '../../context/NPCContextObject';

interface NPCFiltersProps {
  filters: NPCFiltersType;
  onFiltersChange: (filters: Partial<NPCFiltersType>) => void;
  onClearFilters: () => void;
}

export const NPCFilters: React.FC<NPCFiltersProps> = ({
  filters,
  onFiltersChange,
  onClearFilters,
}) => {
  // Get unique values for dropdowns (in a real app, this would come from the data)
  const speciesOptions = ['Human', 'Elf', 'Dwarf', 'Halfling', 'Gnome', 'Half-Elf', 'Half-Orc', 'Tiefling', 'Dragonborn'];

  return (
    <div className="bg-theme-secondary rounded-lg p-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
        {/* Search */}
        <div className="md:col-span-2">
          <label className="block text-sm font-semibold text-theme-tertiary mb-2">
            Search NPCs
          </label>
          <input
            type="text"
            value={filters.search}
            onChange={(e) => onFiltersChange({ search: e.target.value })}
            placeholder="Search by name, species, or occupation..."
            className="w-full px-3 py-2 bg-theme-tertiary text-white rounded-lg border border-theme-primary focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>

        {/* Species Filter */}
        <div>
          <label className="block text-sm font-semibold text-theme-tertiary mb-2">
            Species
          </label>
          <select
            value=""
            onChange={(e) => {
              const value = e.target.value;
              if (value) {
                const newSpecies = filters.species.includes(value)
                  ? filters.species.filter(s => s !== value)
                  : [...filters.species, value];
                onFiltersChange({ species: newSpecies });
              }
            }}
            className="w-full px-3 py-2 bg-theme-tertiary text-white rounded-lg border border-theme-primary focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <option value="">All Species</option>
            {speciesOptions.map(species => (
              <option key={species} value={species}>{species}</option>
            ))}
          </select>
          {filters.species.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {filters.species.map(species => (
                <span
                  key={species}
                  className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-accent-purple text-white"
                >
                  {species}
                  <button
                    onClick={() => onFiltersChange({
                      species: filters.species.filter(s => s !== species)
                    })}
                    className="ml-1 hover:text-accent-purple-light"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Clear Filters Button */}
        <button
          onClick={onClearFilters}
          className="px-4 py-2 bg-theme-quaternary hover:bg-accent-red-dark text-white rounded-lg transition-colors"
        >
          Clear Filters
        </button>
      </div>
    </div>
  );
};