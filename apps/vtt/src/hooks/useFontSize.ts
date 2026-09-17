import { useEffect } from 'react';
import { useGameStore } from '@/stores/gameStore';
import type { FontSize } from '@/types/game';

export const FONT_SIZE_ATTRIBUTE = 'data-font-size';

export const FONT_SIZES: { id: FontSize; label: string }[] = [
  { id: 'xs', label: 'Extra Small' },
  { id: 'small', label: 'Small' },
  { id: 'medium', label: 'Medium (Default)' },
  { id: 'large', label: 'Large' },
  { id: 'xl', label: 'Extra Large' },
];

/**
 * Mirror `settings.fontSize` onto `<html>` so CSS can scale root font-size.
 *
 * Scales the root rem basis:
 * - xs:     87.5%  (~14px base)
 * - small:  93.75% (~15px base)
 * - medium: 100%   (16px base - default, removes attribute)
 * - large:  106.25% (~17px base)
 * - xl:     112.5% (~18px base)
 */
export function useFontSizeSync(): void {
  const fontSize = useGameStore((state) => state.settings?.fontSize ?? 'medium');

  useEffect(() => {
    const root = document.documentElement;
    if (fontSize && fontSize !== 'medium') {
      root.setAttribute(FONT_SIZE_ATTRIBUTE, fontSize);
    } else {
      root.removeAttribute(FONT_SIZE_ATTRIBUTE);
    }
  }, [fontSize]);
}
