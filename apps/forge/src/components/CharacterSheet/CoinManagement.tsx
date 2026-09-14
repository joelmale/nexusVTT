import React, { useState } from 'react';
import { Coins, Plus, Minus } from 'lucide-react';
import { Character } from '../../types/dnd';

interface CoinManagementProps {
  character: Character;
  onUpdateCharacter: (character: Character) => void;
  compact?: boolean;
}

export const CoinManagement: React.FC<CoinManagementProps> = ({
  character,
  onUpdateCharacter,
  compact = false,
}) => {
  const currency = character.currency || { cp: 0, sp: 0, gp: 0, pp: 0 };

  // Full version state (must be declared before any early returns)
  const [coinInputs, setCoinInputs] = useState({
    cp: '',
    sp: '',
    gp: '',
    pp: ''
  });

  const updateCoin = (type: 'cp' | 'sp' | 'gp' | 'pp', amount: number) => {
    const newAmount = Math.max(0, amount);
    const updatedCharacter = {
      ...character,
      currency: {
        ...currency,
        [type]: newAmount
      }
    };
    onUpdateCharacter(updatedCharacter);
  };

  const totalValue = (currency.cp * 0.01) + (currency.sp * 0.1) + currency.gp + (currency.pp * 10);

  if (compact) {
    return (
      <div className="bg-yellow-900 rounded-lg border-l-4 border-yellow-500 p-2">
        <h3 className="text-sm font-bold text-accent-yellow-light mb-2 flex items-center gap-1">
          <Coins className="w-4 h-4" />
          Currency
        </h3>

        {/* Direct Edit Coin Display */}
        <div className="flex justify-between gap-1 mb-2">
          <div className="text-center p-1 bg-theme-secondary/50 rounded flex-1">
            <input
              type="number"
              value={currency.cp}
              onChange={(e) => updateCoin('cp', parseInt(e.target.value) || 0)}
              className="w-full text-center bg-transparent text-lg font-bold text-orange-400 border-none focus:outline-none focus:ring-1 focus:ring-orange-400 rounded text-sm"
              min="0"
            />
            <div className="text-xs text-theme-disabled">CP</div>
          </div>
          <div className="text-center p-1 bg-theme-secondary/50 rounded flex-1">
            <input
              type="number"
              value={currency.sp}
              onChange={(e) => updateCoin('sp', parseInt(e.target.value) || 0)}
              className="w-full text-center bg-transparent text-lg font-bold text-theme-muted border-none focus:outline-none focus:ring-1 focus:ring-gray-400 rounded text-sm"
              min="0"
            />
            <div className="text-xs text-theme-disabled">SP</div>
          </div>
          <div className="text-center p-1 bg-theme-secondary/50 rounded flex-1">
            <input
              type="number"
              value={currency.gp}
              onChange={(e) => updateCoin('gp', parseInt(e.target.value) || 0)}
              className="w-full text-center bg-transparent text-lg font-bold text-accent-yellow-light border-none focus:outline-none focus:ring-1 focus:ring-yellow-400 rounded text-sm"
              min="0"
            />
            <div className="text-xs text-theme-disabled">GP</div>
          </div>
          <div className="text-center p-1 bg-theme-secondary/50 rounded flex-1">
            <input
              type="number"
              value={currency.pp}
              onChange={(e) => updateCoin('pp', parseInt(e.target.value) || 0)}
              className="w-full text-center bg-transparent text-lg font-bold text-accent-blue-light border-none focus:outline-none focus:ring-1 focus:ring-blue-400 rounded text-sm"
              min="0"
            />
            <div className="text-xs text-theme-disabled">PP</div>
          </div>
        </div>

        {/* Total Value */}
        <div className="text-center p-1 bg-theme-secondary/30 rounded">
          <div className="text-sm font-bold text-theme-primary">{totalValue.toFixed(2)} gp</div>
        </div>
      </div>
    );
  }

  const addCoins = () => {
    Object.entries(coinInputs).forEach(([type, value]) => {
      const amount = parseInt(value) || 0;
      if (amount > 0) {
        updateCoin(type as 'cp' | 'sp' | 'gp' | 'pp', (currency[type as keyof typeof currency] || 0) + amount);
      }
    });
    setCoinInputs({ cp: '', sp: '', gp: '', pp: '' });
  };

  const removeCoins = () => {
    Object.entries(coinInputs).forEach(([type, value]) => {
      const amount = parseInt(value) || 0;
      if (amount > 0) {
        updateCoin(type as 'cp' | 'sp' | 'gp' | 'pp', (currency[type as keyof typeof currency] || 0) - amount);
      }
    });
    setCoinInputs({ cp: '', sp: '', gp: '', pp: '' });
  };

  return (
    <div className="bg-yellow-900 rounded-xl shadow-lg border-l-4 border-yellow-500 p-4">
      <h3 className="text-lg font-bold text-accent-yellow-light mb-4 flex items-center gap-2">
        <Coins className="w-5 h-5" />
        Coin Pouch
      </h3>

      {/* Current Coins */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <div className="text-center p-3 bg-theme-secondary/50 rounded-lg">
          <div className="text-2xl font-bold text-orange-400">{currency.cp}</div>
          <div className="text-xs text-theme-muted">Copper</div>
        </div>
        <div className="text-center p-3 bg-theme-secondary/50 rounded-lg">
          <div className="text-2xl font-bold text-theme-muted">{currency.sp}</div>
          <div className="text-xs text-theme-muted">Silver</div>
        </div>
        <div className="text-center p-3 bg-theme-secondary/50 rounded-lg">
          <div className="text-2xl font-bold text-accent-yellow-light">{currency.gp}</div>
          <div className="text-xs text-theme-muted">Gold</div>
        </div>
        <div className="text-center p-3 bg-theme-secondary/50 rounded-lg">
          <div className="text-2xl font-bold text-accent-blue-light">{currency.pp}</div>
          <div className="text-xs text-theme-muted">Platinum</div>
        </div>
      </div>

      {/* Total Value */}
      <div className="text-center mb-4 p-3 bg-theme-secondary/30 rounded-lg">
        <div className="text-lg font-bold text-theme-primary">{totalValue.toFixed(2)} gp</div>
        <div className="text-xs text-theme-muted">Total Value</div>
      </div>

      {/* Coin Management */}
      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-accent-yellow-light">Add/Remove Coins:</h4>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {Object.entries(coinInputs).map(([type, value]) => (
            <div key={type} className="space-y-1">
              <label className="text-xs text-theme-muted uppercase">{type}</label>
              <input
                type="number"
                value={value}
                onChange={(e) => setCoinInputs(prev => ({ ...prev, [type]: e.target.value }))}
                placeholder="0"
                className="w-full px-2 py-1 input-handwritten focus:border-yellow-500 text-sm"
              />
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          <button
            onClick={addCoins}
            className="flex-1 py-2 bg-accent-green hover:bg-accent-green rounded text-sm font-medium transition-colors flex items-center justify-center gap-1"
          >
            <Plus className="w-4 h-4" />
            Add Coins
          </button>
          <button
            onClick={removeCoins}
            className="flex-1 py-2 bg-accent-red hover:bg-accent-red-light rounded text-sm font-medium transition-colors flex items-center justify-center gap-1"
          >
            <Minus className="w-4 h-4" />
            Remove Coins
          </button>
        </div>
      </div>
    </div>
  );
};