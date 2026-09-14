import React from 'react';
import { ArrowRight, ArrowLeft, CheckCircle } from 'lucide-react';

interface SmartNavigationButtonProps {
  canProceed: boolean;
  missingItems: string[];
  nextAction?: string;
  onClick: () => void;
  children: React.ReactNode;
  variant?: 'next' | 'back' | 'finish';
  className?: string;
}

export const SmartNavigationButton: React.FC<SmartNavigationButtonProps> = ({
  canProceed,
  missingItems,
  nextAction,
  onClick,
  children,
  variant = 'next',
  className = ''
}) => {
  const baseClasses = 'px-4 py-2 rounded-lg text-white flex items-center transition-colors disabled:cursor-not-allowed';

  const variantClasses = canProceed
    ? variant === 'next' || variant === 'finish'
      ? 'bg-accent-red hover:bg-accent-red-light'
      : 'bg-theme-quaternary hover:bg-theme-hover'
    : 'bg-gray-600 text-gray-400';

  const buttonClasses = `${baseClasses} ${variantClasses} ${className}`;

  return (
    <div className="flex flex-col items-end space-y-2">
      <button
        onClick={canProceed ? onClick : undefined}
        disabled={!canProceed}
        className={buttonClasses}
      >
        {children}
        {canProceed && variant === 'next' && <ArrowRight className="w-4 h-4 ml-2" />}
        {canProceed && variant === 'back' && <ArrowLeft className="w-4 h-4 ml-2" />}
        {canProceed && variant === 'finish' && <CheckCircle className="w-4 h-4 ml-2" />}
      </button>

      {!canProceed && missingItems.length > 0 && (
        <div className="text-right max-w-xs">
          <div className="text-xs text-yellow-400 font-medium mb-1">
            Required selections remaining:
          </div>
          <ul className="text-xs text-yellow-300 space-y-0.5">
            {missingItems.slice(0, 3).map((item, index) => (
              <li key={index}>• {item}</li>
            ))}
            {missingItems.length > 3 && (
              <li className="text-yellow-400/70">
                • ...and {missingItems.length - 3} more
              </li>
            )}
          </ul>
          {nextAction && (
            <div className="text-xs text-yellow-200 mt-1 italic">
              Next: {nextAction}
            </div>
          )}
        </div>
      )}
    </div>
  );
};