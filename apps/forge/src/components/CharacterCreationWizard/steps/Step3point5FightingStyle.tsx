import React from 'react';
import { ArrowLeft, ArrowRight, Shuffle } from 'lucide-react';
import { StepProps } from '../types/wizard.types';
import { loadClasses, randomizeFightingStyle } from '../../../services/dataService';

interface RandomizeButtonProps {
  onClick: () => void;
  title: string;
}

const RandomizeButton: React.FC<RandomizeButtonProps> = ({ onClick, title }) => (
  <button
    onClick={onClick}
    title={title}
    className="p-2 bg-accent-yellow-dark hover:bg-accent-yellow rounded-lg text-white transition-colors"
  >
    <Shuffle className="w-4 h-4" />
  </button>
);

export const Step3point5FightingStyle: React.FC<StepProps> = ({ data, updateData, nextStep, prevStep }) => {
  const allClasses = loadClasses();
  const selectedClass = allClasses.find(c => c.slug === data.classSlug);
  const hasProcessedAutoAdvance = React.useRef(false);

  // Define fighting styles available in SRD
  const FIGHTING_STYLES = [
    {
      name: 'Archery',
      description: 'You gain a +2 bonus to attack rolls you make with ranged weapons.',
      recommendedFor: ['ranger']
    },
    {
      name: 'Defense',
      description: 'While you are wearing armor, you gain a +1 bonus to AC.',
      recommendedFor: ['paladin']
    },
    {
      name: 'Dueling',
      description: 'When you are wielding a melee weapon in one hand and no other weapons, you gain a +2 bonus to damage rolls with that weapon.',
      recommendedFor: ['fighter']
    },
    {
      name: 'Great Weapon Fighting',
      description: 'When you roll a 1 or 2 on a damage die for an attack you make with a melee weapon that you are wielding with two hands, you can reroll the die and must use the new roll. The weapon must have the two-handed or versatile property.',
      recommendedFor: ['fighter']
    },
    {
      name: 'Protection',
      description: 'When a creature you can see attacks a target other than you that is within 5 feet of you, you can use your reaction to impose disadvantage on the attack roll. You must be wielding a shield.',
      recommendedFor: ['paladin']
    },
    {
      name: 'Two-Weapon Fighting',
      description: 'When you engage in two-weapon fighting, you can add your ability modifier to the damage of the second attack.',
      recommendedFor: ['ranger']
    }
  ];

  // Check if this class gets a fighting style
  const hasFightingStyle = selectedClass && ['fighter', 'paladin', 'ranger'].includes(selectedClass.slug);

  // Get recommended style for this class
  const recommendedStyle = selectedClass ? FIGHTING_STYLES.find(style =>
    style.recommendedFor.includes(selectedClass.slug)
  ) : undefined;

  // Set default if not already selected
  React.useEffect(() => {
    if (!data.selectedFightingStyle && recommendedStyle) {
      updateData({ selectedFightingStyle: recommendedStyle.name });
    }

  }, [recommendedStyle, data.selectedFightingStyle, updateData]);

  // Auto-skip if class doesn't get fighting style (only on first mount)
  React.useEffect(() => {
    if (!hasProcessedAutoAdvance.current && !hasFightingStyle) {
      hasProcessedAutoAdvance.current = true;
      nextStep();
    }
  }, [hasFightingStyle, nextStep]);

  if (!hasFightingStyle) {
     
    return <div className='text-center text-theme-muted'>This class doesn't have Fighting Styles. Advancing...</div>;
  }

  return (
    <div className='space-y-6'>
      <div className='flex justify-between items-start'>
        <div>
          <h3 className='text-xl font-bold text-red-300'>Choose Fighting Style</h3>
          <p className='text-sm text-theme-muted mt-2'>
            As a {selectedClass.name}, you learn a particular style of fighting. Select one Fighting Style option.
          </p>
        </div>
        <RandomizeButton
          onClick={() => {
            const fightingStyle = randomizeFightingStyle(data.classSlug);
            updateData({ selectedFightingStyle: fightingStyle });
          }}
          title="Randomize fighting style"
        />
      </div>

      {recommendedStyle && (
        <div className="bg-blue-900/30 border border-accent-blue-dark rounded-lg p-3">
          <div className="text-sm text-blue-300">
            💡 <strong>Recommended for {selectedClass.name}:</strong> {recommendedStyle.name}
            <br />
            <span className="text-xs text-theme-muted">
              (This is a smart default, but you can choose any style below)
            </span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {FIGHTING_STYLES.map(style => {
          const isSelected = data.selectedFightingStyle === style.name;
          const isRecommended = style.recommendedFor.includes(selectedClass.slug);

          return (
            <button
              key={style.name}
              onClick={() => updateData({ selectedFightingStyle: style.name })}
              className={`p-4 rounded-lg text-left border-2 transition-all ${
                isSelected
                  ? 'bg-orange-800 border-orange-500 shadow-md'
                  : 'bg-theme-tertiary border-theme-primary hover:bg-theme-quaternary'
              }`}
            >
              <div className="flex items-start justify-between">
                <p className="text-base font-bold text-accent-yellow-light">{style.name}</p>
                {isRecommended && (
                  <span className="text-xs bg-accent-blue text-white px-2 py-1 rounded ml-2">
                    Recommended
                  </span>
                )}
              </div>
              <p className="text-sm text-theme-tertiary mt-2">{style.description}</p>
            </button>
          );
        })}
      </div>

      <div className='flex justify-between'>
        <button onClick={prevStep} className="px-4 py-2 bg-theme-quaternary hover:bg-theme-hover rounded-lg text-white flex items-center">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back
        </button>
        <button
          onClick={nextStep}
          disabled={!data.selectedFightingStyle}
          className="px-4 py-2 bg-accent-red hover:bg-accent-red-light rounded-lg text-white flex items-center disabled:bg-theme-quaternary disabled:cursor-not-allowed"
        >
          Next: {selectedClass.spellcasting ? 'Spells' : 'Abilities'} <ArrowRight className="w-4 h-4 ml-2" />
        </button>
      </div>
    </div>
  );
};