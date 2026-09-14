import React, { ReactNode } from 'react';
import { useDiceRolling } from '../hooks';
import { DiceContext } from './DiceContextObject';



interface DiceProviderProps {
  children: ReactNode;
}

export const DiceProvider: React.FC<DiceProviderProps> = ({ children }) => {
  const diceManagement = useDiceRolling();

  return (
    <DiceContext.Provider value={diceManagement}>
      {children}
    </DiceContext.Provider>
  );
};