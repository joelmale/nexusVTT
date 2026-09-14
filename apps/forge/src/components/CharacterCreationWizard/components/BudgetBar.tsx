import React from 'react';
import { Coins, AlertTriangle } from 'lucide-react';

interface BudgetBarProps {
  currentAmount: number;
  maxAmount: number;
  spentAmount?: number;
  currencyLabel?: string;
  showWarning?: boolean;
  className?: string;
}

export const BudgetBar: React.FC<BudgetBarProps> = ({
  currentAmount,
  maxAmount,
  spentAmount,
  currencyLabel = 'gp',
  showWarning: _showWarning = false,
  className = ''
}) => {
  const spent = spentAmount || (maxAmount - currentAmount);
  const percentage = Math.max(0, Math.min(100, (spent / maxAmount) * 100));
  const isOverBudget = currentAmount < 0;

  return (
    <div className={`bg-theme-tertiary p-4 rounded-lg border ${isOverBudget ? 'border-accent-red' : 'border-theme-primary'} ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Coins className={`w-5 h-5 ${isOverBudget ? 'text-accent-red-light' : 'text-accent-yellow-light'}`} />
          <span className={`font-semibold ${isOverBudget ? 'text-accent-red-light' : 'text-accent-yellow-light'}`}>
            {spentAmount !== undefined ? 'Budget' : 'Remaining'}
          </span>
        </div>
        <div className="text-right">
          <div className={`font-bold text-lg ${isOverBudget ? 'text-accent-red-light' : 'text-accent-yellow-light'}`}>
            {Math.max(0, currentAmount)} / {maxAmount} {currencyLabel}
          </div>
          {spentAmount !== undefined && (
            <div className="text-xs text-theme-muted">
              Spent: {spent} {currencyLabel}
            </div>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-theme-quaternary rounded-full h-4 overflow-hidden">
        <div
          className={`h-full transition-all duration-300 ${
            isOverBudget ? 'bg-accent-red' : 'bg-accent-yellow'
          }`}
          style={{ width: `${percentage}%` }}
        />
      </div>

      {isOverBudget && (
        <div className="flex items-center gap-2 mt-2 text-accent-red-light text-sm">
          <AlertTriangle className="w-4 h-4" />
          <span>You've exceeded your budget!</span>
        </div>
      )}
    </div>
  );
};