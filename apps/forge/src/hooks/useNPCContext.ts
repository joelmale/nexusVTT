import { useContext } from 'react';
import { NPCContext } from '../context/NPCContextObject';

export const useNPCContext = () => {
  const context = useContext(NPCContext);
  if (context === undefined) {
    throw new Error('useNPCContext must be used within an NPCProvider');
  }
  return context;
};