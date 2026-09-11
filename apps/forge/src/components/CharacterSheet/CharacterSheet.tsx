import React from 'react';
import { CharacterSheetProps } from '../../types/components';
import { useLayout, useIsMobile } from '../../hooks';
import { ModernStackedLayout, ClassicDndLayout, MobileLayout, PaperSheetLayout } from './layouts';

/**
 * CharacterSheet Wrapper
 *
 * This component selects the appropriate layout based on:
 * - Screen size (mobile always uses ModernStackedLayout)
 * - User preference (desktop can choose between layouts)
 */
export const CharacterSheet: React.FC<CharacterSheetProps> = (props) => {
  const { layoutMode } = useLayout();
  const isMobile = useIsMobile();

  // Mobile always uses ModernStackedLayout
  if (isMobile) {
    return <ModernStackedLayout {...props} />;
  }

  // Desktop uses selected layout
  switch (layoutMode) {
    case 'classic-dnd':
      return <ClassicDndLayout {...props} />;

    case 'paper-sheet':
      return <PaperSheetLayout {...props} />;

    case 'mobile':
      return <MobileLayout {...props} />;

    case 'modern-stacked':
    default:
      return <ModernStackedLayout {...props} />;
  }
};
