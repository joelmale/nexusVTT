import React from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

// Add wiggle animation CSS
const wiggleKeyframes = `
  @keyframes wiggle {
    0%, 100% { transform: rotate(0deg); }
    25% { transform: rotate(-0.5deg); }
    75% { transform: rotate(0.5deg); }
  }
`;

// Inject keyframes into document head if not already present
if (typeof document !== 'undefined' && !document.getElementById('wiggle-keyframes')) {
  const style = document.createElement('style');
  style.id = 'wiggle-keyframes';
  style.textContent = wiggleKeyframes;
  document.head.appendChild(style);
}

interface CollapsibleSectionProps {
  title: string;
  icon?: React.ComponentType<{ className?: string }>;
  isCollapsed: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  className?: string;
  badge?: string | number;
  isAdjustMode?: boolean;
  panelId?: string;
  onDragStart?: (panelId: string) => void;
  onDragEnd?: () => void;
  onDrop?: (targetPanelId: string) => void;
  isDragged?: boolean;
}

export const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({
  title,
  icon: Icon,
  isCollapsed,
  onToggle,
  children,
  className = '',
  badge,
  isAdjustMode = false,
  panelId,
  onDragStart,
  onDragEnd,
  onDrop,
  isDragged = false
}) => {
  const shouldWiggle = false; // Removed wiggle effect to fix linting
  const handleDragStart = (e: React.DragEvent) => {
    if (panelId && onDragStart) {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', panelId);
      onDragStart(panelId);
    }
  };

  const handleDragEnd = () => {
    if (onDragEnd) {
      onDragEnd();
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (panelId && onDrop) {
      const draggedPanelId = e.dataTransfer.getData('text/plain');
      if (draggedPanelId !== panelId) {
        onDrop(panelId);
      }
    }
  };

  return (
    <div
      className={`rounded-xl shadow-lg border-l-4 ${className} ${
        isAdjustMode && isCollapsed ? 'cursor-grab active:cursor-grabbing' : ''
      } ${isDragged ? 'opacity-50' : ''}`}
      style={shouldWiggle ? {
        animation: 'wiggle 0.33s ease-in-out infinite'
      } : undefined}
      onDragOver={isAdjustMode ? handleDragOver : undefined}
      onDrop={isAdjustMode ? handleDrop : undefined}
    >
      {/* Header */}
      <button
        onClick={isAdjustMode && isCollapsed ? undefined : onToggle}
        draggable={isAdjustMode && isCollapsed}
        onDragStart={isAdjustMode && isCollapsed ? handleDragStart : undefined}
        onDragEnd={isAdjustMode && isCollapsed ? handleDragEnd : undefined}
        className={`w-full px-6 py-4 text-left flex items-center justify-between transition-colors group ${
          isAdjustMode && isCollapsed
            ? 'hover:bg-theme-tertiary/70 cursor-grab active:cursor-grabbing'
            : 'hover:bg-theme-secondary/50'
        }`}
        aria-expanded={!isCollapsed}
        aria-controls={`section-${title.toLowerCase().replace(/\s+/g, '-')}`}
      >
        <div className="flex items-center gap-3">
          {Icon && <Icon className="w-5 h-5 text-current" />}
          <h3 className="text-lg heading-parchment">{title}</h3>
          {badge && (
            <span className="px-2 py-1 bg-theme-tertiary text-theme-tertiary rounded-full text-xs font-medium">
              {badge}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isCollapsed ? (
            <ChevronRight className="w-6 h-6 text-white group-hover:text-accent-yellow-light transition-colors" />
          ) : (
            <ChevronDown className="w-6 h-6 text-white group-hover:text-accent-yellow-light transition-colors" />
          )}
        </div>
      </button>

      {/* Content */}
      <div
        id={`section-${title.toLowerCase().replace(/\s+/g, '-')}`}
        className={`overflow-hidden transition-all duration-300 ease-in-out ${
          isCollapsed ? 'max-h-0 opacity-0' : 'max-h-screen opacity-100'
        }`}
      >
        <div className="px-6 pb-4">
          {children}
        </div>
      </div>
    </div>
  );
};