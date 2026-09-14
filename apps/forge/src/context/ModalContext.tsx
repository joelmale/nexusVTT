import React, { ReactNode } from 'react';
import { useModalState } from '../hooks';
import { ModalContext } from './ModalContextObject';

interface ModalProviderProps {
  children: ReactNode;
}

export const ModalProvider: React.FC<ModalProviderProps> = ({ children }) => {
  const modalState = useModalState();

  return (
    <ModalContext.Provider value={modalState}>
      {children}
    </ModalContext.Provider>
  );
};
