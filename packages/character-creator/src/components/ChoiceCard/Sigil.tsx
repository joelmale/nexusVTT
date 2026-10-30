import React from 'react';

/**
 * A small emblem for a class, species or background.
 *
 * These are original placeholder badges (a monogram in a shield), drawn in
 * `currentColor` so they follow the theme. Real artwork replaces them by
 * adding an entry to `artCredits.ts` and an image source here; nothing else
 * about the card changes.
 */
/** Two letters, so Human/Halfling and Dwarf/Dragonborn stay distinguishable. */
function monogram(name: string): string {
  const letters = name.trim().replace(/[^A-Za-z]/g, '');
  return letters.charAt(0).toUpperCase() + letters.charAt(1).toLowerCase();
}

export const Sigil: React.FC<{ name: string; size?: number }> = ({
  name,
  size = 40,
}) => (
  <svg
    className="sigil"
    width={size}
    height={size}
    viewBox="0 0 40 40"
    aria-hidden="true"
    focusable="false"
  >
    <path
      d="M20 2 36 8v12c0 9-6.5 15.5-16 18C10.500 35.500 4 29 4 20V8z"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    />
    <text
      x="20"
      y="25"
      textAnchor="middle"
      fontSize="14"
      fontWeight="700"
      fill="currentColor"
      fontFamily="Georgia, serif"
    >
      {monogram(name)}
    </text>
  </svg>
);
