import React, { useState, useMemo } from 'react';
import { ArrowLeft, Dice6, Shuffle } from 'lucide-react';
import { StepProps } from '../types/wizard.types';
import { CharacterCreationData, AbilityName } from '../../../types/dnd';
import { getAllSpecies, randomizeAbilities, getModifier, BACKGROUNDS } from '../../../services/dataService';
import { rollDice } from '../../../services/diceService';
import { SmartNavigationButton } from '../components';
import { useStepValidation } from '../hooks';
import {
  getAvailableStandardArrayScores,
  ABILITY_NAMES,
  STANDARD_ARRAY_SCORES,
  calculatePointBuyCost,
  isValidPointBuyChange,
  ABILITY_METHOD_TITLES,
  POINT_BUY_COSTS
} from '../../../utils/abilityScoreUtils';

const RandomizeButton: React.FC<{ onClick: () => void; title?: string; className?: string }> = ({
  onClick,
  title = "Randomize this section",
  className = ""
}) => {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-2 bg-accent-purple hover:bg-accent-purple-light rounded-lg text-white text-sm font-medium transition-colors flex items-center gap-2 ${className}`}
      title={title}
    >
      <Shuffle className="w-4 h-4" />
      Randomize
    </button>
  );
};

const formatModifier = (mod: number): string => mod >= 0 ? `+${mod}` : `${mod}`;

export const Step4Abilities: React.FC<StepProps> = ({ data, updateData, nextStep, prevStep, getNextStepLabel }) => {
  const allSpecies = getAllSpecies(data.edition);
  const speciesData = allSpecies.find(s => s.slug === data.speciesSlug);
  const backgroundData = BACKGROUNDS.find(bg => bg.slug === data.background && bg.edition === data.edition);
  const abilityNames = ABILITY_NAMES;

  // Validation hook
  const { canProceed, missingItems, nextAction } = useStepValidation(4, data);

  // Helper to get bonus based on edition
  const getBonus = (ability: AbilityName) => {
    // Species bonuses apply in both editions
    const speciesBonus = speciesData?.ability_bonuses?.[ability] || 0;

    if (data.edition === '2024') {
      // In 2024, bonuses come from Species + Background (User Selected)
      const userBonus = data.backgroundAbilityChoices?.bonuses?.[ability] || 0;
      // Background bonuses are in addition to species bonuses
      return speciesBonus + userBonus;
    } else {
      // In 2014, bonuses come from Species only
      return speciesBonus;
    }
  };

  const bonusSourceLabel = data.edition === '2024' ? '(Background)' : '(Species)';

  // Method-specific data
  const standardArrayScores = useMemo(() => STANDARD_ARRAY_SCORES, []);
  const [pointBuyPoints, setPointBuyPoints] = useState(27);
  const [rolledSets, setRolledSets] = useState<number[][]>([]);



  // Handle method change
  const handleMethodChange = (method: CharacterCreationData['abilityScoreMethod']) => {
    const resetAbilities = method === 'point-buy'
      ? { STR: 8, DEX: 8, CON: 8, INT: 8, WIS: 8, CHA: 8 }
      : { STR: 0, DEX: 0, CON: 0, INT: 0, WIS: 0, CHA: 0 };

    updateData({
      abilityScoreMethod: method,
      abilities: resetAbilities
    });
    setRolledSets([]);
    setPointBuyPoints(27);
  };

  // Standard Array: assign scores from predefined array
  const availableScores = getAvailableStandardArrayScores(Object.values(data.abilities));

  const handleAssignScore = (ability: AbilityName, score: number) => {
    const currentScore = data.abilities[ability];

    // If selecting the same score that's already assigned, do nothing
    if (currentScore === score) return;

    // If ability has no score and score is available, assign it
    if (currentScore === 0 && availableScores.includes(score)) {
      updateData({ abilities: { ...data.abilities, [ability]: score } });
      return;
    }

    // If ability already has a score, we need to handle reassignment
    if (currentScore > 0) {
      // If the new score is available, swap it
      if (availableScores.includes(score)) {
        updateData({ abilities: { ...data.abilities, [ability]: score } });
        return;
      }

      // If the new score is already assigned to another ability, swap them
      const abilityToSwap = abilityNames.find(a => data.abilities[a] === score);
      if (abilityToSwap) {
        updateData({
          abilities: {
            ...data.abilities,
            [ability]: score,
            [abilityToSwap]: currentScore
          }
        });
      }
    }
  };

  // Dice rolling methods
  const rollAbilityScores = (method: 'standard-roll' | 'classic-roll' | '5d6-drop-2') => {
    const sets: number[][] = [];

    for (let i = 0; i < 6; i++) {
      let rolls: number[];

      if (method === 'standard-roll') {
        // 4d6, drop lowest
        rolls = rollDice(4, 6).sort((a, b) => b - a).slice(0, 3);
      } else if (method === 'classic-roll') {
        // 3d6 straight
        rolls = rollDice(3, 6);
      } else {
        // 5d6, drop two lowest
        rolls = rollDice(5, 6).sort((a, b) => b - a).slice(0, 3);
      }

      sets.push(rolls);
    }

    setRolledSets(sets);

    // Auto-assign in order for classic roll
    if (method === 'classic-roll') {
      const scores = sets.map(s => s.reduce((a, b) => a + b, 0));
      updateData({
        abilities: {
          STR: scores[0],
          DEX: scores[1],
          CON: scores[2],
          INT: scores[3],
          WIS: scores[4],
          CHA: scores[5]
        }
      });
    }
  };

  // Assign rolled score
  const handleAssignRolledScore = (ability: AbilityName, setIndex: number) => {
    const score = rolledSets[setIndex].reduce((a, b) => a + b, 0);
    const currentScore = data.abilities[ability];

    // Check if this rolled set is already assigned to another ability
    const assignedAbility = abilityNames.find(a =>
      a !== ability && data.abilities[a] === score &&
      rolledSets.findIndex(set => set.reduce((sum, n) => sum + n, 0) === score) === setIndex
    );

    if (assignedAbility) {
      // Swap with the ability that currently has this rolled set
      updateData({
        abilities: {
          ...data.abilities,
          [ability]: score,
          [assignedAbility]: currentScore
        }
      });
    } else if (currentScore === 0) {
      // Assign to empty ability
      updateData({ abilities: { ...data.abilities, [ability]: score } });
    } else {
      // Reassign from current score to new score (if current score was from a rolled set)
      updateData({ abilities: { ...data.abilities, [ability]: score } });
    }
  };

  const handlePointBuyChange = (ability: AbilityName, newScore: number) => {
    const oldScore = data.abilities[ability];
    const pointDiff = calculatePointBuyCost(oldScore, newScore);

    if (isValidPointBuyChange(oldScore, newScore, pointBuyPoints)) {
      updateData({ abilities: { ...data.abilities, [ability]: newScore } });
      setPointBuyPoints(pointBuyPoints - pointDiff);
    }
  };

  // Custom input
  const handleCustomInput = (ability: AbilityName, value: string) => {
    const score = parseInt(value) || 0;
    if (score >= 0 && score <= 20) {
      updateData({ abilities: { ...data.abilities, [ability]: score } });
    }
  };

  return (
    <div className='space-y-6'>
      {/* Method Selection Dropdown */}
      <div>
        <label className="block text-sm font-medium text-theme-tertiary mb-2">Ability Score Method</label>
        <select
          value={data.abilityScoreMethod}
          onChange={(e) => handleMethodChange(e.target.value as CharacterCreationData['abilityScoreMethod'])}
          className="w-full p-3 bg-theme-tertiary text-white rounded-lg font-semibold text-lg"
        >
          {Object.entries(ABILITY_METHOD_TITLES).map(([key, title]) => (
            <option key={key} value={key}>{title}</option>
          ))}
        </select>
      </div>

       <div className='flex justify-between items-center'>
         <h3 className='text-xl font-bold text-red-300'>
           Determine Ability Scores ({ABILITY_METHOD_TITLES[data.abilityScoreMethod]})
         </h3>
         <RandomizeButton
           onClick={() => {
             const abilities = randomizeAbilities();
             updateData(abilities);
           }}
           title="Randomize ability scores and method"
         />
       </div>

       {/* Character Summary - Species & Background Bonuses */}
       <div className="bg-theme-secondary/50 border border-theme-primary rounded-lg p-4 space-y-4">
         <h4 className="text-lg font-bold text-accent-yellow-light">Character Summary</h4>

         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
           {/* Species Information */}
           <div className="bg-theme-tertiary/50 p-3 rounded-lg">
             <h5 className="text-sm font-semibold text-accent-blue-light mb-2">Species: {speciesData?.name || 'Unknown'}</h5>
             {speciesData?.ability_bonuses && Object.keys(speciesData.ability_bonuses).length > 0 ? (
               <div className="space-y-1">
                 <div className="text-xs font-medium text-theme-muted uppercase">Ability Bonuses:</div>
                 {Object.entries(speciesData.ability_bonuses).map(([ability, bonus]) => (
                   <div key={ability} className="text-sm text-theme-primary flex items-center">
                     <span className="text-accent-yellow-light mr-2">•</span>
                     {ability}: +{bonus}
                   </div>
                 ))}
               </div>
             ) : (
               <div className="text-sm text-theme-muted">
                 {data.edition === '2024'
                   ? 'No ability bonuses (moved to Background in 2024)'
                   : 'No ability bonuses'
                 }
               </div>
             )}
           </div>

           {/* Background Information */}
           <div className="bg-theme-tertiary/50 p-3 rounded-lg">
             <h5 className="text-sm font-semibold text-accent-green-light mb-2">Background: {backgroundData?.name || 'Unknown'}</h5>
             {data.edition === '2024' ? (
               <div className="space-y-1">
                 <div className="text-xs font-medium text-theme-muted uppercase">Ability Bonuses:</div>
                 {data.backgroundAbilityChoices?.bonuses && Object.keys(data.backgroundAbilityChoices.bonuses).length > 0 ? (
                   Object.entries(data.backgroundAbilityChoices.bonuses).map(([ability, bonus]) => (
                     <div key={ability} className="text-sm text-theme-primary flex items-center">
                       <span className="text-accent-yellow-light mr-2">•</span>
                       {ability}: +{bonus} (from background choice)
                     </div>
                   ))
                 ) : (
                   <div className="text-sm text-theme-muted">No ability bonuses selected yet</div>
                 )}
               </div>
             ) : (
               <div className="text-sm text-theme-muted">Background bonuses not used in 2014</div>
             )}
           </div>
         </div>

         {/* Total Bonuses Summary */}
         <div className="bg-theme-tertiary/30 p-3 rounded-lg">
           <h5 className="text-sm font-semibold text-theme-muted uppercase mb-2">Total Racial/Background Bonuses:</h5>
           <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
             {abilityNames.map(ability => {
               const bonus = getBonus(ability);
               return (
                 <div key={ability} className="text-center">
                   <div className="text-sm font-medium text-theme-primary">{ability}</div>
                   <div className={`text-lg font-bold ${bonus > 0 ? 'text-accent-green-light' : 'text-theme-muted'}`}>
                     {bonus > 0 ? `+${bonus}` : '0'}
                   </div>
                 </div>
               );
             })}
           </div>
         </div>
       </div>

      {/* Standard Array UI */}
      {data.abilityScoreMethod === 'standard-array' && (
        <>
          <div className='flex flex-wrap gap-2 mb-4 p-3 bg-theme-tertiary rounded-lg'>
            <span className='text-sm font-semibold text-theme-muted mr-2'>Scores to Assign:</span>
            {standardArrayScores.map(s => (
              <span key={s} className={`px-3 py-1 text-lg font-bold rounded-full ${availableScores.includes(s) ? 'bg-accent-yellow text-gray-900' : 'bg-theme-quaternary text-theme-muted'}`}>
                {s}
              </span>
            ))}
          </div>

          <div className='grid grid-cols-2 gap-4'>
            {abilityNames.map(ability => {
              const baseScore = data.abilities[ability];
              const bonus = getBonus(ability);
              const finalScore = baseScore + bonus;
              const modifier = getModifier(finalScore);

              return (
                <div key={ability} className='p-3 bg-theme-secondary rounded-lg border-l-4 border-red-500'>
                  <p className='text-lg font-bold text-accent-red-light mb-1'>{ability}</p>
                  <div className='flex items-center justify-between'>
                    <select
                      value={baseScore}
                      onChange={(e) => handleAssignScore(ability, parseInt(e.target.value))}
                      className="p-2 bg-theme-tertiary rounded-lg text-white font-mono"
                    >
                      <option value={0}>Select...</option>
                      {standardArrayScores.map(s => (
                        <option
                          key={s}
                          value={s}
                          disabled={baseScore !== s && !availableScores.includes(s)}
                        >
                          {s}
                        </option>
                      ))}
                    </select>

                    <span className='text-xl text-accent-yellow-light font-bold'>
                      {baseScore > 0 && `${finalScore} (${formatModifier(modifier)})`}
                    </span>
                  </div>
                  {bonus > 0 && baseScore > 0 && <p className='text-xs text-accent-green-light mt-1'>+ {bonus} {bonusSourceLabel}</p>}
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Dice Rolling UIs */}
      {(data.abilityScoreMethod === 'standard-roll' || data.abilityScoreMethod === 'classic-roll' || data.abilityScoreMethod === '5d6-drop-2') && (
        <>
          <button
            onClick={() => rollAbilityScores(data.abilityScoreMethod as 'standard-roll' | 'classic-roll' | '5d6-drop-2')}
            className="w-full p-3 bg-accent-purple hover:bg-accent-purple-light rounded-lg text-white font-bold flex items-center justify-center gap-2"
          >
            <Dice6 className="w-5 h-5" />
            {rolledSets.length === 0 ? 'Roll Ability Scores' : 'Re-roll All Scores'}
          </button>

          {rolledSets.length > 0 && (
            <>
              {data.abilityScoreMethod !== 'classic-roll' && (
                <div className='p-3 bg-theme-tertiary rounded-lg'>
                  <span className='text-sm font-semibold text-theme-muted'>Rolled Sets (assign to abilities):</span>
                  <div className='flex flex-wrap gap-2 mt-2'>
                    {rolledSets.map((set, idx) => {
                      const total = set.reduce((a, b) => a + b, 0);
                      const isAssigned = Object.values(data.abilities).includes(total);
                      return (
                        <div key={idx} className={`px-3 py-2 rounded-lg ${isAssigned ? 'bg-theme-quaternary' : 'bg-accent-yellow text-gray-900'}`}>
                          <div className='text-xs font-mono'>[{set.join(', ')}]</div>
                          <div className='text-lg font-bold text-center'>{total}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className='grid grid-cols-2 gap-4'>
                {abilityNames.map((ability, idx) => {
                  const baseScore = data.abilities[ability];
                  const bonus = getBonus(ability);
                  const finalScore = baseScore + bonus;
                  const modifier = getModifier(finalScore);

                  return (
                    <div key={ability} className='p-3 bg-theme-secondary rounded-lg border-l-4 border-red-500'>
                      <p className='text-lg font-bold text-accent-red-light mb-1'>{ability}</p>
                      <div className='flex items-center justify-between'>
                        {data.abilityScoreMethod === 'classic-roll' ? (
                          <div className='text-sm font-mono text-theme-muted'>
                            [{rolledSets[idx]?.join(', ')}]
                          </div>
                        ) : (
                          <select
                            value={baseScore}
                            onChange={(e) => handleAssignRolledScore(ability, parseInt(e.target.value))}
                            className="p-2 bg-theme-tertiary rounded-lg text-white font-mono"
                          >
                            <option value={0}>Select...</option>
                            {rolledSets.map((set, setIdx) => {
                              const total = set.reduce((a, b) => a + b, 0);
                              return (
                                <option key={setIdx} value={setIdx}>
                                  {total} [{set.join(', ')}]
                                </option>
                              );
                            })}
                          </select>
                        )}

                        <span className='text-xl text-accent-yellow-light font-bold'>
                          {baseScore > 0 && `${finalScore} (${formatModifier(modifier)})`}
                        </span>
                      </div>
                      {bonus > 0 && baseScore > 0 && <p className='text-xs text-accent-green-light mt-1'>+ {bonus} {bonusSourceLabel}</p>}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </>
      )}

      {/* Point Buy UI */}
      {data.abilityScoreMethod === 'point-buy' && (
        <>
          <div className='p-4 bg-purple-900/30 border border-accent-purple rounded-lg'>
            <div className='flex justify-between items-center'>
              <span className='text-sm font-semibold text-theme-tertiary'>Points Remaining:</span>
              <span className='text-3xl font-bold text-accent-yellow-light'>{pointBuyPoints}</span>
            </div>
            <p className='text-xs text-theme-muted mt-2'>Scores range from 8-15. Higher scores cost more points.</p>
          </div>

          <div className='grid grid-cols-2 gap-4'>
            {abilityNames.map(ability => {
              const baseScore = data.abilities[ability] || 8;
              const bonus = getBonus(ability);
              const finalScore = baseScore + bonus;
              const modifier = getModifier(finalScore);

              return (
                <div key={ability} className='p-3 bg-theme-secondary rounded-lg border-l-4 border-red-500'>
                  <p className='text-lg font-bold text-accent-red-light mb-1'>{ability}</p>
                  <div className='flex items-center justify-between'>
                    <select
                      value={baseScore}
                      onChange={(e) => handlePointBuyChange(ability, parseInt(e.target.value))}
                      className="p-2 bg-theme-tertiary rounded-lg text-white font-mono"
                    >
                      {Object.keys(POINT_BUY_COSTS).map(score => {
                        const s = parseInt(score);
                        const cost = POINT_BUY_COSTS[s];
                        const currentCost = POINT_BUY_COSTS[baseScore] || 0;
                        const wouldExceed = (cost - currentCost) > pointBuyPoints;

                        return (
                          <option key={s} value={s} disabled={wouldExceed && baseScore !== s}>
                            {s} ({cost} pts)
                          </option>
                        );
                      })}
                    </select>

                    <span className='text-xl text-accent-yellow-light font-bold'>
                      {finalScore} ({formatModifier(modifier)})
                    </span>
                  </div>
                  {bonus > 0 && <p className='text-xs text-accent-green-light mt-1'>+ {bonus} {bonusSourceLabel}</p>}
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Custom Entry UI */}
      {data.abilityScoreMethod === 'custom' && (
        <>
          <div className='p-3 bg-yellow-900/30 border border-yellow-500 rounded-lg'>
            <p className='text-sm text-yellow-200'>
              <span className='font-bold'>DM Override:</span> Enter custom ability scores (1-20). Consult with your DM.
            </p>
          </div>

          <div className='grid grid-cols-2 gap-4'>
            {abilityNames.map(ability => {
              const baseScore = data.abilities[ability];
              const bonus = getBonus(ability);
              const finalScore = baseScore + bonus;
              const modifier = getModifier(finalScore);

              return (
                <div key={ability} className='p-3 bg-theme-secondary rounded-lg border-l-4 border-red-500'>
                  <p className='text-lg font-bold text-accent-red-light mb-1'>{ability}</p>
                  <div className='flex items-center justify-between'>
                    <input
                      type="number"
                      min="1"
                      max="20"
                      value={baseScore || ''}
                      onChange={(e) => handleCustomInput(ability, e.target.value)}
                      className="p-2 bg-theme-tertiary rounded-lg text-white font-mono w-20"
                      placeholder="0"
                    />

                    <span className='text-xl text-accent-yellow-light font-bold'>
                      {baseScore > 0 && `${finalScore} (${formatModifier(modifier)})`}
                    </span>
                  </div>
                  {bonus > 0 && baseScore > 0 && <p className='text-xs text-accent-green-light mt-1'>+ {bonus} {bonusSourceLabel}</p>}
                </div>
              );
            })}
          </div>
        </>
      )}

      <div className='flex justify-between'>
        <button onClick={prevStep} className="px-4 py-2 bg-theme-quaternary hover:bg-theme-hover rounded-lg text-white flex items-center">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back
        </button>
        <SmartNavigationButton
          canProceed={canProceed}
          missingItems={missingItems}
          nextAction={nextAction}
          onClick={nextStep}
          variant="next"
        >
          Next: {getNextStepLabel?.() || 'Continue'}
        </SmartNavigationButton>
      </div>
    </div>
  );
};
