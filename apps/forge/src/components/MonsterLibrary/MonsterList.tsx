import React from 'react';
import { Monster, UserMonster } from '../../types/dnd';
import { MonsterCard } from './MonsterCard';
import { EncounterMonsterSelection } from '../../context/MonsterContextObject';

interface MonsterListProps {
  monsters: (Monster | UserMonster)[];
  onSelectMonster: (monster: Monster | UserMonster) => void;
  selectionMode: boolean;
  selectedMonsters: EncounterMonsterSelection;
  onToggleSelection: (monsterId: string) => void;
  onSetQuantity: (monsterId: string, quantity: number) => void;
  onEditMonster?: (monster: UserMonster) => void;
}

const EmptyState: React.FC = () => (
  <div className="text-center p-12 bg-theme-secondary rounded-xl border-2 border-dashed border-theme-secondary">
    <div className="text-6xl mb-4">🐉</div>
    <p className="text-xl font-semibold text-theme-muted">No monsters found</p>
    <p className="text-theme-disabled">Try adjusting your filters or create a custom monster</p>
  </div>
);

export const MonsterList: React.FC<MonsterListProps> = ({
  monsters,
  onSelectMonster,
  selectionMode,
  selectedMonsters,
  onToggleSelection,
  onSetQuantity,
  onEditMonster,
}) => {
  if (monsters.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {monsters.map((monster) => {
        const quantity = selectedMonsters[monster.index] || 0;
        const isSelected = quantity > 0;

        return (
          <MonsterCard
            key={monster.index}
            monster={monster}
            onView={() => onSelectMonster(monster)}
            selectionMode={selectionMode}
            isSelected={isSelected}
            quantity={quantity}
            onToggleSelection={() => onToggleSelection(monster.index)}
            onSetQuantity={(qty) => onSetQuantity(monster.index, qty)}
            onEdit={onEditMonster && 'isCustom' in monster && monster.isCustom ? () => onEditMonster(monster) : undefined}
          />
        );
      })}
    </div>
  );
};
