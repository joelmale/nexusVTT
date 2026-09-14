import { useContext } from 'react';
import { ModalContext } from '../context/ModalContextObject';

export const useModalContext = () => {
  const context = useContext(ModalContext);
  if (context === undefined) {
    throw new Error('useModalContext must be used within a ModalProvider');
  }
  return context;
};