import React, { useState, useEffect } from 'react';
import { Search, X } from 'lucide-react';
import { useMonsterContext } from '../../hooks';
import { MONSTER_TYPE_CATEGORIES } from '../../services/dataService';
import { MonsterSize, MonsterType } from '../../types/dnd';

const MONSTER_SIZES: MonsterSize[] = ['Tiny', 'Small', 'Medium', 'Large', 'Huge', 'Gargantuan'];

const CR_QUICK_RANGES = [
  { label: 'Easy (0-4)', min: 0, max: 4 },
  { label: 'Medium (5-10)', min: 5, max: 10 },
  { label: 'Hard (11-16)', min: 11, max: 16 },
  { label: 'Deadly (17+)', min: 17, max: 30 },
];

export const MonsterFilters: React.FC = () => {
  const { filters, setFilters, clearFilters } = useMonsterContext();
  const [searchInput, setSearchInput] = useState(filters.search);
  const [isExpanded, setIsExpanded] = useState(false);

  // Debounce search input (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setFilters({ search: searchInput });
    }, 300);

    return () => clearTimeout(timer);
  }, [searchInput, setFilters]);

  const handleTypeToggle = (type: MonsterType) => {
    const newTypes = filters.types.includes(type)
      ? filters.types.filter((t) => t !== type)
      : [...filters.types, type];
    setFilters({ types: newTypes });
  };

  const handleSizeToggle = (size: MonsterSize) => {
    const newSizes = filters.sizes.includes(size)
      ? filters.sizes.filter((s) => s !== size)
      : [...filters.sizes, size];
    setFilters({ sizes: newSizes });
  };

  const handleQuickCRRange = (min: number, max: number) => {
    setFilters({ crMin: min, crMax: max });
  };

  const hasActiveFilters =
    filters.search ||
    filters.types.length > 0 ||
    filters.sizes.length > 0 ||
    filters.crMin !== 0 ||
    filters.crMax !== 30 ||
    filters.hasLegendaryActions !== null ||
    filters.showFavoritesOnly ||
    filters.showCustomOnly ||
    filters.showSRDOnly;

  return (
    <div className="bg-theme-secondary rounded-xl p-4 space-y-4">
      {/* Search and Toggle */}
      <div className="flex gap-3 items-center">
        <div className="flex-grow relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-theme-muted w-5 h-5" />
          <input
            type="text"
            placeholder="Search monsters..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-theme-tertiary text-white rounded-lg border border-theme-primary focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
          {searchInput && (
            <button
              onClick={() => setSearchInput('')}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-theme-muted hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="px-4 py-2 bg-theme-tertiary text-white rounded-lg hover:bg-theme-quaternary transition-colors whitespace-nowrap"
        >
          {isExpanded ? 'Hide' : 'Show'} Filters
        </button>

        {hasActiveFilters && (
          <button
            onClick={() => {
              clearFilters();
              setSearchInput('');
            }}
            className="px-4 py-2 bg-accent-red text-white rounded-lg hover:bg-accent-red-dark transition-colors whitespace-nowrap"
          >
            Clear All
          </button>
        )}
      </div>

      {/* Expanded Filters */}
      {isExpanded && (
        <div className="space-y-4 pt-4 border-t border-theme-secondary">
          {/* Quick CR Ranges */}
          <div>
            <label className="block text-sm font-semibold text-theme-tertiary mb-2">
              Quick CR Ranges
            </label>
            <div className="flex flex-wrap gap-2">
              {CR_QUICK_RANGES.map((range) => (
                <button
                  key={range.label}
                  onClick={() => handleQuickCRRange(range.min, range.max)}
                  className={`px-3 py-1 rounded-lg text-sm transition-colors ${
                    filters.crMin === range.min && filters.crMax === range.max
                      ? 'bg-accent-purple text-white'
                      : 'bg-theme-tertiary text-theme-tertiary hover:bg-theme-quaternary'
                  }`}
                >
                  {range.label}
                </button>
              ))}
            </div>
          </div>

          {/* CR Range Sliders */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-theme-tertiary mb-2">
                Min CR: {filters.crMin}
              </label>
              <input
                type="range"
                min="0"
                max="30"
                value={filters.crMin}
                onChange={(e) => setFilters({ crMin: parseInt(e.target.value) })}
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-theme-tertiary mb-2">
                Max CR: {filters.crMax}
              </label>
              <input
                type="range"
                min="0"
                max="30"
                value={filters.crMax}
                onChange={(e) => setFilters({ crMax: parseInt(e.target.value) })}
                className="w-full"
              />
            </div>
          </div>

          {/* Monster Types */}
          <div>
            <label className="block text-sm font-semibold text-theme-tertiary mb-2">
              Creature Types
            </label>
            <div className="flex flex-wrap gap-2">
              {MONSTER_TYPE_CATEGORIES.map((category) => (
                <button
                  key={category.type}
                  onClick={() => handleTypeToggle(category.type)}
                  className={`px-3 py-1.5 rounded-lg text-sm transition-colors flex items-center gap-1 ${
                    filters.types.includes(category.type)
                      ? 'bg-accent-purple text-white'
                      : 'bg-theme-tertiary text-theme-tertiary hover:bg-theme-quaternary'
                  }`}
                  title={category.description}
                >
                  <span>{category.icon}</span>
                  <span>{category.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Monster Sizes */}
          <div>
            <label className="block text-sm font-semibold text-theme-tertiary mb-2">
              Size
            </label>
            <div className="flex flex-wrap gap-2">
              {MONSTER_SIZES.map((size) => (
                <button
                  key={size}
                  onClick={() => handleSizeToggle(size)}
                  className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                    filters.sizes.includes(size)
                      ? 'bg-accent-purple text-white'
                      : 'bg-theme-tertiary text-theme-tertiary hover:bg-theme-quaternary'
                  }`}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>

          {/* Special Filters */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={filters.showFavoritesOnly}
                onChange={(e) => setFilters({ showFavoritesOnly: e.target.checked })}
                className="w-4 h-4 text-accent-purple bg-theme-tertiary border-theme-primary rounded focus:ring-purple-500"
              />
              <span className="text-sm text-theme-tertiary">Favorites Only</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={filters.showCustomOnly}
                onChange={(e) => setFilters({ showCustomOnly: e.target.checked })}
                className="w-4 h-4 text-accent-purple bg-theme-tertiary border-theme-primary rounded focus:ring-purple-500"
              />
              <span className="text-sm text-theme-tertiary">Custom Only</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={filters.showSRDOnly}
                onChange={(e) => setFilters({ showSRDOnly: e.target.checked })}
                className="w-4 h-4 text-accent-purple bg-theme-tertiary border-theme-primary rounded focus:ring-purple-500"
              />
              <span className="text-sm text-theme-tertiary">SRD Only</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={filters.hasLegendaryActions === true}
                onChange={(e) =>
                  setFilters({ hasLegendaryActions: e.target.checked ? true : null })
                }
                className="w-4 h-4 text-accent-purple bg-theme-tertiary border-theme-primary rounded focus:ring-purple-500"
              />
              <span className="text-sm text-theme-tertiary">Has Legendary Actions</span>
            </label>
          </div>
        </div>
      )}
    </div>
  );
};
