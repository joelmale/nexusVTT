import { useContext } from 'react';
import { DiceContext } from '../context/DiceContextObject';

export const useDiceContext = () => {
  const context = useContext(DiceContext);
  if (context === undefined) {
    throw new Error('useDiceContext must be used within a DiceProvider');
  }
  return context;
};