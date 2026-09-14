import React from 'react';
import { Layout, Smartphone, BookOpen } from 'lucide-react';
import { useLayout } from '../../context';
import type { LayoutMode } from './AbilityScores';

export const LayoutSelector: React.FC = () => {
  const { layoutMode, setLayoutMode } = useLayout();

  const layouts: { value: LayoutMode; label: string; icon: React.ReactNode }[] = [
    { value: 'classic-dnd', label: 'Classic D&D', icon: <Layout className="w-4 h-4" /> },
    { value: 'paper-sheet', label: 'Paper Sheet', icon: <BookOpen className="w-4 h-4" /> },
    { value: 'mobile', label: 'Mobile', icon: <Smartphone className="w-4 h-4" /> },
  ];

  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-theme-muted">Layout:</span>
      <div className="flex flex-col gap-0 bg-theme-secondary rounded-lg p-1">
        {layouts.map((l) => (
          <button
            key={l.value}
            onClick={() => setLayoutMode(l.value)}
            className={`
              flex items-center gap-1 px-3 py-1 rounded text-xs font-medium transition-all
              ${
                layoutMode === l.value
                  ? 'bg-accent-blue text-white'
                  : 'text-theme-muted hover:text-white hover:bg-theme-tertiary'
              }
            `}
            title={`Switch to ${l.label} layout`}
          >
            {l.icon}
            <span>{l.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};
