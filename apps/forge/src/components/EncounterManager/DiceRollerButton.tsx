import React from 'react';

interface DiceRollerButtonProps {
  onOpenDiceModal: () => void;
  className?: string;
}

export function DiceRollerButton({ onOpenDiceModal, className = '' }: DiceRollerButtonProps) {
  return (
    <button
      onClick={onOpenDiceModal}
      className={`dice-roller-button ${className}`}
      title="Open Dice Roller"
    >
      <span className="dice-icon">🎲</span>
      <span className="dice-label">Roll Dice</span>
    </button>
  );
}