import React, { useState, useRef, useEffect } from 'react';
import { WeaponOption } from '../types/widgets';
import masteryData from '../data/srd/2024/5e-SRD-Weapon-Mastery-Properties.json';

interface WeaponMasteryTooltipProps {
  weapon: WeaponOption;
  children: React.ReactNode;
}

interface WeaponMasteryProperty {
  index: string;
  name: string;
  description: string;
}

// Load mastery properties data
const loadWeaponMasteryProperties = (): WeaponMasteryProperty[] => {
  return masteryData as WeaponMasteryProperty[];
};
const WeaponMasteryTooltip: React.FC<WeaponMasteryTooltipProps> = ({ weapon, children }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [triggerTop, setTriggerTop] = useState(0);
  const triggerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  // Load mastery data
  const masteryProperties = loadWeaponMasteryProperties();
  const masteryData = masteryProperties.find(prop => prop.index === weapon.mastery);

  useEffect(() => {
    if (isVisible && triggerRef.current && tooltipRef.current) {
      const triggerRect = triggerRef.current.getBoundingClientRect();
      const tooltipRect = tooltipRef.current.getBoundingClientRect();

      // Position tooltip above the trigger element, centered
      const left = triggerRect.left + (triggerRect.width / 2) - (tooltipRect.width / 2);
      const top = triggerRect.top - tooltipRect.height - 8; // 8px gap

      // Adjust if tooltip would go off-screen
      const adjustedLeft = Math.max(8, Math.min(left, window.innerWidth - tooltipRect.width - 8));
      const adjustedTop = top < 0 ? triggerRect.bottom + 8 : top;

      setPosition({ top: adjustedTop, left: adjustedLeft });
      setTriggerTop(triggerRect.top);
    }
  }, [isVisible]);

  // Only show tooltip if weapon has mastery
  if (!weapon.mastery || !masteryData) {
    return <>{children}</>;
  }

  return (
    <div
      ref={triggerRef}
      className="relative inline-block w-full"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
    >
      {children}

      {isVisible && (
        <div
          ref={tooltipRef}
          className="fixed z-[9999] bg-theme-primary text-theme-primary rounded-lg shadow-2xl border border-theme-primary p-4 w-80 pointer-events-none"
          style={{
            top: `${position.top}px`,
            left: `${position.left}px`,
          }}
        >
          {/* Weapon Header */}
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-bold text-purple-300">{weapon.name}</h3>
            <div className="flex items-center gap-2">
              <span className="text-xs px-2 py-1 bg-theme-tertiary rounded text-theme-tertiary capitalize">
                {weapon.category}
              </span>
              <span className="text-xs px-2 py-1 bg-theme-tertiary rounded text-theme-tertiary">
                {weapon.weaponRange}
              </span>
            </div>
          </div>

          {/* Weapon Stats */}
          <div className="mb-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-theme-tertiary">Damage:</span>
              <span className="text-sm font-semibold text-accent-yellow-light">{weapon.damage}</span>
            </div>
            {weapon.properties.length > 0 && (
              <div className="mb-2">
                <span className="text-sm text-theme-tertiary">Properties:</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {weapon.properties.map((prop, idx) => (
                    <span key={idx} className="text-xs px-2 py-1 bg-theme-secondary rounded text-theme-muted capitalize">
                      {prop}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {weapon.isTwoHanded && (
              <div className="text-xs text-gray-400 bg-gray-700 px-2 py-1 rounded inline-block">
                Two-Handed
              </div>
            )}
          </div>

          {/* Mastery Section */}
          <div className="bg-theme-secondary rounded p-3 border-l-4 border-accent-purple">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm font-bold text-accent-purple">🎯 Weapon Mastery:</span>
              <span className="text-sm font-semibold text-purple-300">{masteryData.name}</span>
            </div>
            <p className="text-sm text-purple-200 leading-relaxed">
              {masteryData.description}
            </p>
          </div>

          {/* Arrow pointer */}
          <div
            className="absolute w-3 h-3 bg-theme-primary border-r border-b border-theme-primary transform rotate-45"
            style={{
              bottom: position.top < triggerTop ? 'auto' : '-6px',
              top: position.top < triggerTop ? '-6px' : 'auto',
              left: '50%',
              marginLeft: '-6px',
            }}
          />
        </div>
      )}
    </div>
  );
};

export default WeaponMasteryTooltip;