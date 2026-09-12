import React from 'react';

interface TokenCategoryTabsProps {
  activeCategory: 'all' | 'pc' | 'npc' | 'monster';
  onCategoryChange: (category: 'all' | 'pc' | 'npc' | 'monster') => void;
  categoryCounts: {
    all: number;
    pc: number;
    npc: number;
    monster: number;
  };
}

const categoryConfig = {
  all: {
    icon: '📋',
    label: 'All',
    cssVar: '--color-accent',
  },
  pc: {
    icon: '👥',
    label: 'PCs',
    cssVar: '--color-primary',
  },
  npc: {
    icon: '🧙',
    label: 'NPCs',
    cssVar: '--color-secondary',
  },
  monster: {
    icon: '🧌',
    label: 'Monsters',
    cssVar: '--color-accent',
  },
};

export const TokenCategoryTabs: React.FC<TokenCategoryTabsProps> = ({
  activeCategory,
  onCategoryChange,
  categoryCounts,
}) => {
  const handleKeyDown = (
    e: React.KeyboardEvent,
    category: 'all' | 'pc' | 'npc' | 'monster',
  ) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onCategoryChange(category);
    }
  };

  return (
    <div
      className="token-category-tabs"
      style={{
        width: '48px',
        borderRight: '1px solid var(--glass-border)',
        background: 'var(--glass-surface)',
        display: 'flex',
        flexDirection: 'column',
        padding: '8px 0',
        gap: '4px',
      }}
    >
      {(Object.keys(categoryConfig) as Array<keyof typeof categoryConfig>).map(
        (category) => {
          const config = categoryConfig[category];
          const isActive = activeCategory === category;
          const count = categoryCounts[category];
          const categoryColor = `var(${config.cssVar})`;

          return (
            <div
              key={category}
              role="tab"
              aria-selected={isActive}
              aria-label={`${config.label} tokens (${count})`}
              tabIndex={0}
              onClick={() => onCategoryChange(category)}
              onKeyDown={(e) => handleKeyDown(e, category)}
              className={`token-category-tab ${isActive ? 'active' : ''}`}
              style={{
                padding: '12px 4px',
                margin: isActive ? '0 0 0 0' : '0 0 0 4px',
                cursor: 'pointer',
                textAlign: 'center',
                fontSize: '11px',
                fontWeight: isActive ? 700 : 500,
                borderRight: isActive
                  ? `3px solid ${categoryColor}`
                  : '3px solid transparent',
                borderRadius: '8px 0 0 8px',
                transition: 'all 0.2s ease',
                background: isActive
                  ? 'var(--glass-surface-strong)'
                  : 'transparent',
                boxShadow: isActive
                  ? '-2px 0 8px rgba(var(--color-surface-rgb), 0.2)'
                  : 'none',
                color: isActive ? categoryColor : 'var(--glass-text-muted)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '4px',
                position: 'relative',
                outline: 'none',
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background =
                    'var(--glass-surface-hover)';
                  e.currentTarget.style.boxShadow =
                    '-2px 0 4px rgba(var(--color-surface-rgb), 0.1)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.boxShadow = 'none';
                }
              }}
              onFocus={(e) => {
                e.currentTarget.style.outline = `2px solid ${categoryColor}`;
                e.currentTarget.style.outlineOffset = '2px';
              }}
              onBlur={(e) => {
                e.currentTarget.style.outline = 'none';
              }}
            >
              <span style={{ fontSize: '20px', display: 'block' }}>
                {config.icon}
              </span>
              <span
                style={{
                  fontSize: '9px',
                  lineHeight: '1.2',
                  display: 'block',
                  fontWeight: isActive ? 700 : 500,
                }}
              >
                {config.label}
              </span>
              <span
                style={{
                  fontSize: '10px',
                  opacity: 0.7,
                  display: 'block',
                  fontWeight: isActive ? 600 : 400,
                }}
              >
                ({count})
              </span>
            </div>
          );
        },
      )}
    </div>
  );
};
