import React from 'react';
import { ParchmentPanel } from '../atoms/ParchmentPanel';
import { SectionDivider } from '../atoms/SectionDivider';

export interface SpellEntity {
  name: string;
  level: string | number;
  school: string;
  castingTime: string;
  range: string;
  components: string;
  duration: string;
  description: string;
}

export interface MonsterEntity {
  name: string;
  size: string;
  type: string;
  alignment: string;
  ac: number | string;
  hp: number | string;
  speed: string;
  cr: string | number;
  stats?: {
    strength: number;
    dexterity: number;
    constitution: number;
    intelligence: number;
    wisdom: number;
    charisma: number;
  };
  description?: string;
}

interface EntityStatCardProps {
  type: 'spell' | 'monster' | 'item';
  data: any; // Checked dynamically
  className?: string;
}

export const EntityStatCard: React.FC<EntityStatCardProps> = ({
  type,
  data,
  className = '',
}) => {
  if (type === 'spell') {
    const spell = data as SpellEntity;
    return (
      <ParchmentPanel variant="ivory" className={`max-w-md ${className}`}>
        <div className="flex justify-between items-start">
          <div>
            <h3 className="font-['Cinzel',serif] text-lg font-bold text-[#2C1E16] leading-tight">
              {spell.name}
            </h3>
            <span className="font-sans text-[10px] text-amber-800 uppercase font-semibold tracking-wider">
              {spell.level === 0 || spell.level === '0' || String(spell.level).toLowerCase() === 'cantrip'
                ? `${spell.school} cantrip`
                : `Level ${spell.level} ${spell.school}`}
            </span>
          </div>
        </div>

        <SectionDivider className="my-2" />

        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs font-serif text-[#2C1E16]">
          <div>
            <span className="font-sans text-[9px] font-bold uppercase tracking-wider text-[#2C1E16]/50">
              Casting Time
            </span>
            <p className="font-semibold">{spell.castingTime}</p>
          </div>
          <div>
            <span className="font-sans text-[9px] font-bold uppercase tracking-wider text-[#2C1E16]/50">
              Range
            </span>
            <p className="font-semibold">{spell.range}</p>
          </div>
          <div>
            <span className="font-sans text-[9px] font-bold uppercase tracking-wider text-[#2C1E16]/50">
              Components
            </span>
            <p className="font-semibold">{spell.components}</p>
          </div>
          <div>
            <span className="font-sans text-[9px] font-bold uppercase tracking-wider text-[#2C1E16]/50">
              Duration
            </span>
            <p className="font-semibold">{spell.duration}</p>
          </div>
        </div>

        <SectionDivider className="my-2" />

        <div className="text-xs font-serif leading-relaxed text-[#2C1E16] mt-2 whitespace-pre-wrap">
          {spell.description}
        </div>
      </ParchmentPanel>
    );
  }

  if (type === 'monster') {
    const monster = data as MonsterEntity;
    return (
      <ParchmentPanel variant="vellum" className={`max-w-md ${className}`}>
        <div>
          <h3 className="font-['Cinzel',serif] text-lg font-bold text-[#2C1E16] leading-tight">
            {monster.name}
          </h3>
          <span className="font-sans text-[10px] text-[#2C1E16]/60 uppercase font-semibold tracking-wider">
            {monster.size} {monster.type}, {monster.alignment}
          </span>
        </div>

        <SectionDivider className="my-2" />

        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs font-serif text-[#2C1E16]">
          <div>
            <span className="font-sans text-[9px] font-bold uppercase tracking-wider text-[#2C1E16]/50">
              Armor Class
            </span>
            <p className="font-semibold">{monster.ac}</p>
          </div>
          <div>
            <span className="font-sans text-[9px] font-bold uppercase tracking-wider text-[#2C1E16]/50">
              Hit Points
            </span>
            <p className="font-semibold">{monster.hp}</p>
          </div>
          <div>
            <span className="font-sans text-[9px] font-bold uppercase tracking-wider text-[#2C1E16]/50">
              Speed
            </span>
            <p className="font-semibold">{monster.speed}</p>
          </div>
          <div>
            <span className="font-sans text-[9px] font-bold uppercase tracking-wider text-[#2C1E16]/50">
              Challenge (CR)
            </span>
            <p className="font-semibold">{monster.cr}</p>
          </div>
        </div>

        {monster.stats && (
          <>
            <SectionDivider className="my-2" />
            <div className="grid grid-cols-6 text-center gap-1">
              {Object.entries(monster.stats).map(([stat, val]) => {
                const mod = Math.floor((val - 10) / 2);
                const modSign = mod >= 0 ? `+${mod}` : `${mod}`;
                return (
                  <div key={stat} className="bg-[#2c1e16]/5 p-1 rounded-sm">
                    <span className="font-sans text-[8px] font-bold uppercase text-[#2C1E16]/50 block">
                      {stat.slice(0, 3)}
                    </span>
                    <span className="text-xs font-bold font-serif text-[#2C1E16]">
                      {val}
                    </span>
                    <span className="text-[9px] text-[#2C1E16]/70 block font-mono">
                      ({modSign})
                    </span>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {monster.description && (
          <>
            <SectionDivider className="my-2" />
            <div className="text-xs font-serif leading-relaxed text-[#2C1E16] whitespace-pre-wrap">
              {monster.description}
            </div>
          </>
        )}
      </ParchmentPanel>
    );
  }

  // Fallback for Generic Items
  return (
    <ParchmentPanel variant="ivory" className={`max-w-md ${className}`}>
      <h3 className="font-['Cinzel',serif] text-lg font-bold text-[#2C1E16]">
        {data.name || 'Game Entity'}
      </h3>
      {data.description && (
        <>
          <SectionDivider className="my-2" />
          <p className="text-xs font-serif leading-relaxed text-[#2C1E16]">
            {data.description}
          </p>
        </>
      )}
    </ParchmentPanel>
  );
};
