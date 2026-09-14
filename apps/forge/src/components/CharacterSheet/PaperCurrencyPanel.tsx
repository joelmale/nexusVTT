import React from 'react';
import { Character } from '../../types/dnd';

interface PaperCurrencyPanelProps {
  character: Character;
  onUpdateCharacter: (character: Character) => void;
}

/**
 * PaperCurrencyPanel - Custom currency display with parchment background image
 *
 * Displays currency (CP, SP, EP, GP, PP) overlaid on a decorative background image
 * featuring a coin pouch illustration. Uses Homemade Apple font for handwritten aesthetic.
 */
export const PaperCurrencyPanel: React.FC<PaperCurrencyPanelProps> = ({
  character,
  onUpdateCharacter,
}) => {
  const currency = character.currency || { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 };

  const updateCoin = (type: 'cp' | 'sp' | 'ep' | 'gp' | 'pp', amount: number) => {
    const newAmount = Math.max(0, amount);
    onUpdateCharacter({
      ...character,
      currency: {
        ...currency,
        [type]: newAmount
      }
    });
  };

  return (
    <div
      className="relative w-full h-[280px] bg-contain bg-no-repeat bg-center"
      style={{ backgroundImage: 'url(/assets/MoneyPouch.webp)' }}
    >
      {/* Currency input boxes - positioned to align with image boxes */}
      <div className="absolute bottom-[50px] left-10 right-0 flex justify-center gap-[10px] px-12">
        {/* CP - Copper */}
        <div className="flex flex-col items-center w-[40px]">
          <input
            type="number"
            value={currency.cp}
            onChange={(e) => updateCoin('cp', parseInt(e.target.value) || 0)}
            className="w-full text-center bg-transparent homemade-apple-regular text-[#3d2817] text-2xl border-none focus:outline-none focus:ring-0 tabular-nums"
            aria-label="Copper pieces"
            min="0"
          />
        </div>

        {/* SP - Silver */}
        <div className="flex flex-col items-center w-[40px]">
          <input
            type="number"
            value={currency.sp}
            onChange={(e) => updateCoin('sp', parseInt(e.target.value) || 0)}
            className="w-full text-center bg-transparent homemade-apple-regular text-[#3d2817] text-2xl border-none focus:outline-none focus:ring-0 tabular-nums"
            aria-label="Silver pieces"
            min="0"
          />
        </div>

        {/* EP - Electrum */}
        <div className="flex flex-col items-center w-[40px]">
          <input
            type="number"
            value={currency.ep || 0}
            onChange={(e) => updateCoin('ep', parseInt(e.target.value) || 0)}
            className="w-full text-center bg-transparent homemade-apple-regular text-[#3d2817] text-2xl border-none focus:outline-none focus:ring-0 tabular-nums"
            aria-label="Electrum pieces"
            min="0"
          />
        </div>

        {/* GP - Gold */}
        <div className="flex flex-col items-center w-[40px]">
          <input
            type="number"
            value={currency.gp}
            onChange={(e) => updateCoin('gp', parseInt(e.target.value) || 0)}
            className="w-full text-center bg-transparent homemade-apple-regular text-[#3d2817] text-2xl border-none focus:outline-none focus:ring-0 tabular-nums"
            aria-label="Gold pieces"
            min="0"
          />
        </div>

        {/* PP - Platinum */}
        <div className="flex flex-col items-center w-[60px]">
          <input
            type="number"
            value={currency.pp}
            onChange={(e) => updateCoin('pp', parseInt(e.target.value) || 0)}
            className="w-full text-center bg-transparent homemade-apple-regular text-[#3d2817] text-2xl border-none focus:outline-none focus:ring-0 tabular-nums"
            aria-label="Platinum pieces"
            min="0"
          />
        </div>
      </div>
    </div>
  );
};
