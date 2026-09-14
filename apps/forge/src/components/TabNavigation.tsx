import React, { ReactNode } from 'react';

export type TabId = 'characters' | 'monsters' | 'npcs' | 'spellbook';

interface TabItem {
  id: TabId;
  label: string;
  icon?: ReactNode;
}

interface TabNavigationProps {
  activeTab: TabId;
  onTabChange: (id: TabId) => void;
}

const TABS: TabItem[] = [
  {
    id: 'characters',
    label: 'Characters',
    icon: <span className="w-4 h-4 mr-2">🛡️</span>,
  },
  { id: 'monsters', label: 'Monster Library', icon: '🐉' },
  { id: 'npcs', label: 'NPC Library', icon: '🧙‍♂️' },
  { id: 'spellbook', label: 'Spellbook', icon: '📖' },
];

const ACTIVE_TAB_CLASSES: Record<TabId, string> = {
  characters: 'text-accent-red-light border-accent-red-dark',
  monsters: 'text-accent-purple-light border-accent-purple-dark',
  npcs: 'text-accent-green-light border-accent-green-dark',
  spellbook: 'text-accent-blue-light border-accent-blue-dark',
};

const ACTIVE_LINE_CLASSES: Record<TabId, string> = {
  characters: 'bg-accent-red-dark',
  monsters: 'bg-accent-purple-dark',
  npcs: 'bg-accent-green-dark',
  spellbook: 'bg-accent-blue-dark',
};

export const TabNavigation: React.FC<TabNavigationProps> = ({ activeTab, onTabChange }) => {
  return (
    <div className="flex flex-col md:flex-row justify-between items-end mb-4 relative">
      <div className={`absolute left-0 right-0 bottom-0 h-[2px] z-20 ${ACTIVE_LINE_CLASSES[activeTab]}`} />

      <h1 className="text-4xl font-extrabold text-red-500 mb-4 md:mb-0">
        NexusForge
      </h1>

      <div className="flex gap-1 mb-[-1px] relative">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          const activeClasses = ACTIVE_TAB_CLASSES[tab.id];

          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`
                px-6 py-3 font-bold transition-all rounded-t-lg border-t-2 border-l-2 border-r-2
                relative cursor-pointer
                ${
                  isActive
                    ? `z-30 bg-theme-primary ${activeClasses} translate-y-0`
                    : 'z-10 bg-theme-secondary text-theme-muted border-theme-secondary translate-y-[-1px] hover:bg-gray-700'
                }
              `}
              style={{
                borderBottom: isActive ? '2px solid rgb(17, 24, 39)' : 'none',
                clipPath: !isActive ? 'inset(-20px 0px 0px 0px)' : 'none',
              }}
            >
              {tab.icon && <span className="inline-block">{tab.icon}</span>}
              <span className={tab.icon ? 'ml-2' : ''}>{tab.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
