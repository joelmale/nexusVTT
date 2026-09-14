import React, { useState, useRef, useEffect } from 'react';
import skillsData from '../data/skills.json';

interface SkillTooltipProps {
  skillName: string;
  children: React.ReactNode;
}

interface Skill {
  name: string;
  ability: string;
  description: string;
  example: string;
}

const SkillTooltip: React.FC<SkillTooltipProps> = ({ skillName, children }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [triggerTop, setTriggerTop] = useState(0);
  const triggerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  // Find skill data
  const skillData = (skillsData as Skill[]).find(
    (skill) => skill.name.toLowerCase() === skillName.toLowerCase()
  );

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

  if (!skillData) {
    return <>{children}</>;
  }

  return (
    <div
      ref={triggerRef}
      className="relative inline-block"
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
          {/* Skill Name and Ability */}
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-lg font-bold text-purple-300">{skillData.name}</h3>
            <span className="text-xs px-2 py-1 bg-theme-tertiary rounded text-theme-tertiary">
              {skillData.ability}
            </span>
          </div>

          {/* Description */}
          <p className="text-sm text-theme-tertiary mb-3 leading-relaxed">
            {skillData.description}
          </p>

          {/* Example */}
          <div className="bg-theme-secondary rounded p-3 border-l-4 border-accent-purple">
            <p className="text-xs text-theme-muted mb-1 font-semibold">Example Usage:</p>
            <p className="text-sm text-purple-200 italic">"{skillData.example}"</p>
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

export default SkillTooltip;
