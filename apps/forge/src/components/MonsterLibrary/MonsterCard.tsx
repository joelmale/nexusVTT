import React from 'react';
import { Eye, Star, Edit2, Trash2, Plus, Minus, ExternalLink } from 'lucide-react';
import { Monster, UserMonster } from '../../types/dnd';
import { useMonsterContext } from '../../hooks';
import { generateMonsterSlug } from '../../utils/monsterUtils';

interface MonsterCardProps {
  monster: Monster | UserMonster;
  onView: () => void;
  selectionMode: boolean;
  isSelected: boolean;
  quantity?: number;
  onToggleSelection: () => void;
  onSetQuantity?: (quantity: number) => void;
  onEdit?: () => void;
}

const getCRColor = (cr: number): string => {
  if (cr <= 4) return 'bg-accent-green';
  if (cr <= 10) return 'bg-accent-yellow-dark';
  if (cr <= 16) return 'bg-orange-600';
  return 'bg-accent-red';
};

const getACDisplay = (armorClass: Monster['armor_class']): string => {
  if (Array.isArray(armorClass) && armorClass.length > 0) {
    return armorClass[0].value.toString();
  }
  return '10';
};

const getSpeedDisplay = (speed: Monster['speed']): string => {
  if (speed.walk) return speed.walk;
  if (speed.fly) return `fly ${speed.fly}`;
  if (speed.swim) return `swim ${speed.swim}`;
  return '0 ft.';
};

export const MonsterCard: React.FC<MonsterCardProps> = ({
  monster,
  onView,
  selectionMode,
  isSelected,
  quantity = 0,
  onToggleSelection,
  onSetQuantity,
  onEdit,
}) => {
  const { isFavorited, toggleFavorite, deleteCustomMonster } = useMonsterContext();
  const isFav = isFavorited(monster.index);
  const isCustom = 'isCustom' in monster && monster.isCustom;

  const getMonsterUrl = (): string => {
    if (isCustom) {
      return `${window.location.origin}/monster/custom-${monster.index}`;
    } else {
      return `${window.location.origin}/monster/${generateMonsterSlug(monster.name)}`;
    }
  };

  const handleOpenInNewTab = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.open(getMonsterUrl(), '_blank');
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isCustom) return;

    if (window.confirm(`Delete "${monster.name}"? This action cannot be undone.`)) {
      await deleteCustomMonster((monster as UserMonster).id);
    }
  };

  const handleFavoriteClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await toggleFavorite(monster.index);
  };

  const handleCardClick = () => {
    if (selectionMode) {
      onToggleSelection();
    } else {
      onView();
    }
  };

  return (
    <div
      className={`bg-theme-secondary rounded-xl shadow-xl hover:shadow-purple-700/30 transition-all duration-300 overflow-hidden cursor-pointer ${
        isSelected ? 'ring-4 ring-blue-500' : ''
      }`}
      onClick={handleCardClick}
    >
      <div className="p-5">
        {/* Header with name and favorite */}
        <div className="flex items-start justify-between mb-2">
          <div className="flex-grow">
            <div className="flex items-center gap-2">
              <h3 className="text-2xl font-bold text-accent-purple-light">{monster.name}</h3>
              {isCustom && (
                <span className="px-2 py-0.5 bg-accent-green text-white text-xs rounded-full">
                  Custom
                </span>
              )}
            </div>
            <p className="text-sm text-theme-muted">
              {monster.size} {monster.type}
              {monster.subtype && ` (${monster.subtype})`}
            </p>
          </div>

          {!selectionMode && (
            <button
              onClick={handleFavoriteClick}
              className="ml-2 p-1 hover:scale-110 transition-transform"
              title={isFav ? 'Remove from favorites' : 'Add to favorites'}
            >
              <Star
                className={`w-5 h-5 ${
                  isFav ? 'fill-yellow-400 text-accent-yellow-light' : 'text-theme-disabled'
                }`}
              />
            </button>
          )}

          {selectionMode && (
            <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
              <input
                type="checkbox"
                checked={isSelected}
                onChange={(e) => {
                  e.stopPropagation();
                  onToggleSelection();
                }}
                className="w-5 h-5 text-accent-blue bg-theme-tertiary border-theme-primary rounded focus:ring-blue-500 focus:ring-2 cursor-pointer"
                onClick={(e) => e.stopPropagation()}
              />
              {isSelected && onSetQuantity && (
                <div className="flex items-center gap-1 bg-theme-tertiary rounded-lg px-2 py-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onSetQuantity(Math.max(1, quantity - 1));
                    }}
                    className="p-1 hover:bg-theme-quaternary rounded transition-colors"
                    title="Decrease quantity"
                  >
                    <Minus className="w-4 h-4 text-accent-blue-light" />
                  </button>
                  <span className="px-2 font-bold text-accent-blue-light min-w-[2rem] text-center">
                    {quantity}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onSetQuantity(quantity + 1);
                    }}
                    className="p-1 hover:bg-theme-quaternary rounded transition-colors"
                    title="Increase quantity"
                  >
                    <Plus className="w-4 h-4 text-accent-blue-light" />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* CR Badge */}
        <div className="mb-3">
          <span
            className={`inline-block px-3 py-1 ${getCRColor(
              monster.challenge_rating
            )} text-white text-sm font-bold rounded-full`}
          >
            CR {monster.challenge_rating} ({monster.xp.toLocaleString()} XP)
          </span>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-3 gap-2 text-center text-xs font-medium bg-theme-tertiary/50 p-3 rounded-lg mb-3">
          <div>
            AC:{' '}
            <span className="text-theme-primary block text-lg font-bold">
              {getACDisplay(monster.armor_class)}
            </span>
          </div>
          <div>
            HP:{' '}
            <span className="text-theme-primary block text-lg font-bold">{monster.hit_points}</span>
          </div>
          <div>
            Speed:{' '}
            <span className="text-theme-secondary block text-sm font-bold">
              {getSpeedDisplay(monster.speed)}
            </span>
          </div>
        </div>

        {/* Additional Info */}
        <div className="text-xs text-theme-muted space-y-1">
          {monster.legendary_actions && monster.legendary_actions.length > 0 && (
            <div className="flex items-center gap-1">
              <span className="text-accent-yellow">⚡</span>
              <span>Legendary Actions</span>
            </div>
          )}
          {monster.special_abilities && monster.special_abilities.length > 0 && (
            <div className="flex items-center gap-1">
              <span className="text-purple-500">✨</span>
              <span>{monster.special_abilities.length} Special Abilities</span>
            </div>
          )}
        </div>

        {/* Action Buttons (only when not in selection mode) */}
        {!selectionMode && (
          <div className="mt-4 space-y-2">
            <div className="flex gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onView();
                }}
                className="flex-1 py-2 bg-accent-purple hover:bg-accent-purple-light rounded-lg text-white font-semibold transition-colors flex items-center justify-center text-sm"
              >
                <Eye className="w-4 h-4 mr-2" /> View Stat Block
              </button>
              <button
                onClick={handleOpenInNewTab}
                className="px-3 py-2 bg-accent-blue hover:bg-accent-blue-light rounded-lg text-white font-semibold transition-colors flex items-center justify-center text-sm"
                title="Open in new tab"
              >
                <ExternalLink className="w-4 h-4" />
              </button>
            </div>

            {/* Edit/Delete buttons for custom monsters */}
            {isCustom && onEdit && (
              <div className="flex gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit();
                  }}
                  className="flex-1 py-2 bg-accent-blue hover:bg-accent-blue-light rounded-lg text-white font-semibold transition-colors flex items-center justify-center text-sm"
                >
                  <Edit2 className="w-4 h-4 mr-1" /> Edit
                </button>
                <button
                  onClick={handleDelete}
                  className="flex-1 py-2 bg-accent-red hover:bg-accent-red-light rounded-lg text-white font-semibold transition-colors flex items-center justify-center text-sm"
                >
                  <Trash2 className="w-4 h-4 mr-1" /> Delete
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
