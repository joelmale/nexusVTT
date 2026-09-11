import React from 'react';
import { CharacterProvider, MonsterProvider, NPCProvider, DiceProvider, ModalProvider, LayoutProvider, ThemeProvider } from './context';
import App from './App';

const AppWithProviders: React.FC = () => {
  return (
    <ThemeProvider>
      <CharacterProvider>
        <MonsterProvider>
          <NPCProvider>
            <DiceProvider>
              <ModalProvider>
                <LayoutProvider>
                  <App />
                </LayoutProvider>
              </ModalProvider>
            </DiceProvider>
          </NPCProvider>
        </MonsterProvider>
      </CharacterProvider>
    </ThemeProvider>
  );
};

export default AppWithProviders;