import React from 'react';
import { ArrowLeft, ArrowRight, Shuffle, ChevronDown } from 'lucide-react';
import { StepProps } from '../types/wizard.types';
import { EquipmentPackage, TrinketData, EquipmentChoice } from '../../../types/dnd';
import { loadClasses, BACKGROUNDS, EQUIPMENT_PACKAGES } from '../../../services/dataService';
import { validateEquipmentChoices, getMissingEquipmentChoices } from '../../../utils/equipmentSelectionUtils';
import trinketTable from '../../../data/trinketTable.json';
import { QuickStartEquipment } from '../components/QuickStartEquipment';
import { generateQuickStartEquipment, rollStartingWealth } from '../../../services/equipmentService';
import { EquipmentShop } from '../components/EquipmentShop';
import { TrinketRoller } from '../components/TrinketRoller';
import { PurchasedItem } from '../../../types/equipment';

interface EquipmentPackDisplayProps {
  pack: EquipmentPackage;
  isSelected?: boolean;
  onClick?: () => void;
  showRecommendation?: boolean;
  characterClass?: string;
}

const EquipmentPackDisplay: React.FC<EquipmentPackDisplayProps> = ({
  pack,
  isSelected = false,
  onClick,
  showRecommendation = false,
  characterClass
}) => {
  const [isExpanded, setIsExpanded] = React.useState(false);

  const isRecommended = characterClass && pack.recommendedFor?.includes(characterClass);

  return (
    <div className={`border-2 rounded-lg transition-all ${
      isSelected
        ? 'bg-accent-blue-darker border-blue-500'
        : 'bg-theme-tertiary border-theme-primary hover:bg-theme-quaternary'
    }`}>
      <button
        onClick={onClick}
        className="w-full p-3 text-left"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="text-white font-medium">{pack.name}</span>
            {pack.startingGold && pack.startingGold > 0 && (
              <span className="text-accent-yellow-light text-sm">({pack.startingGold} gp)</span>
            )}
            {showRecommendation && isRecommended && (
              <span className="px-2 py-1 text-xs bg-accent-green-dark text-green-200 rounded">
                Recommended
              </span>
            )}
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
            className="p-1 hover:bg-theme-quaternary rounded"
          >
            <ChevronDown className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </button>

      {isExpanded && (
        <div className="px-3 pb-3 border-t border-theme-primary mt-2 pt-2">
          <div className="text-xs text-theme-muted mb-2">Contents:</div>
          <ul className="text-sm space-y-1">
            {pack.items.map((item, idx) => (
              <li key={idx} className="flex items-center justify-between">
                <span className="text-theme-tertiary">
                  • {item.name}
                  {item.quantity > 1 && <span className="text-theme-muted ml-1">x{item.quantity}</span>}
                </span>
                {item.equipped && (
                  <span className="text-xs text-accent-green-light">(equipped)</span>
                )}
              </li>
            ))}
          </ul>
          {pack.description && (
            <p className="text-xs text-theme-disabled mt-2 italic">{pack.description}</p>
          )}
        </div>
      )}
    </div>
  );
};

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

export const Step6Equipment: React.FC<StepProps & { skipToStep?: (step: number) => void }> = ({
  data,
  updateData,
  nextStep,
  prevStep,
  skipToStep,
  getNextStepLabel
}) => {
  const allClasses = loadClasses();
  const selectedClass = allClasses.find(c => c.slug === data.classSlug);

  // Equipment mode state
  const [equipmentMode, setEquipmentMode] = React.useState<'quickstart' | 'buy' | 'choices' | 'background-choice'>(
    data.edition === '2024' ? 'background-choice' : 'quickstart'
  );

  // Background equipment choice state
  const [backgroundChoice, setBackgroundChoice] = React.useState<'background' | 'gold' | null>(
    data.equipmentChoice || null
  );

  // Gold rolling state
  const [goldRolled, setGoldRolled] = React.useState(data.equipmentChoice === 'gold');
  const [startingGold, setStartingGold] = React.useState(data.equipmentChoice === 'gold' ? (data.equipmentGold || 50) : 0);

  const [rolledTrinket, setRolledTrinket] = React.useState<TrinketData | null>(data.selectedTrinket || null);

  // Fighter build selection state
  const [selectedFighterBuild, setSelectedFighterBuild] = React.useState<string | null>(null);

  // Missing choices modal state
  const [showMissingChoicesModal, setShowMissingChoicesModal] = React.useState(false);

   // Equipment choices state
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [selectedEquipment, setSelectedEquipment] = React.useState<EquipmentChoice[]>(data.equipmentChoices || []);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [showEquipmentShop, setShowEquipmentShop] = React.useState(false);
  const [missingChoices, setMissingChoices] = React.useState<number[]>([]);

  // Stub implementations for incomplete features
  const _useExtendedTrinkets = false;
  const handleEquipmentChoice = (_choiceId: string, _optionIdx: number) => {
    // TODO: Implement equipment choice handling
  };

  // Fighter build mappings to equipment choice indices
  const fighterBuilds = {
    defender: {
      name: 'The Defender (Tank)',
      description: 'Highest possible Armor Class from level 1. You are the party\'s protector.',
      choices: [0, 0, 1, 0], // Choice indices: [choice1, choice2, choice3, choice4]
      color: 'accent-green'
    },
    striker: {
      name: 'The Striker (Two-Handed Damage)',
      description: 'Maximum damage output, sacrificing some AC for power.',
      choices: [0, 1, 1, 0],
      color: 'accent-red'
    },
    archer: {
      name: 'The Archer (Dexterity-Based)',
      description: 'Ranged combat specialist using high Dexterity.',
      choices: [1, 0, 0, 0],
      color: 'accent-blue'
    }
  };

  const handleFighterBuildSelect = (buildKey: string) => {
    const build = fighterBuilds[buildKey as keyof typeof fighterBuilds];
    if (!build) return;

    const currentChoices = data.equipmentChoices || [];
    const updatedChoices = currentChoices.map((choice, index) => ({
      ...choice,
      selected: build.choices[index] || 0
    }));

    updateData({ equipmentChoices: updatedChoices });
    setSelectedFighterBuild(buildKey);
  };

  const allChoicesMade = equipmentMode === 'choices'
    ? validateEquipmentChoices(data.equipmentChoices || [])
    : equipmentMode === 'quickstart' || (equipmentMode === 'buy' && goldRolled);

  // Trinket rolling function
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _rollForTrinket = () => {
    const maxRoll = _useExtendedTrinkets ? 200 : 100;
    const roll = Math.floor(Math.random() * maxRoll) + 1;
    const trinket = (trinketTable as TrinketData[]).find(t => t.roll === roll);

    if (trinket) {
      updateData({ selectedTrinket: trinket });
      setRolledTrinket(trinket);
    }
  };

  return (
    <div className='space-y-6'>
      <div className='flex justify-between items-start'>
        <div className='flex-1'>
          <h3 className='text-xl font-bold text-red-300'>Select Starting Equipment</h3>
          <p className="text-sm text-theme-muted mt-1">
            Choose your starting equipment based on your class. Your background will also grant additional items.
          </p>
        </div>
        <RandomizeButton
          onClick={() => {
            // Randomize equipment choices - this would need implementation

          }}
          title="Randomize equipment choices"
        />
      </div>

       {/* Equipment Mode Selection */}
       {equipmentMode === 'background-choice' && data.edition === '2024' ? (
         <div className="bg-theme-secondary/50 border border-theme-primary rounded-lg p-4 space-y-4">
           <h4 className="text-lg font-bold text-accent-yellow-light">Choose Your Starting Equipment</h4>
           <p className="text-sm text-theme-muted">
             Your background provides you with starting equipment. You can take this equipment or exchange it for 50 gp to spend in the shop.
           </p>

           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             {/* Background Equipment Option */}
             <button
               onClick={() => {
                 setBackgroundChoice('background');
                 updateData({ equipmentChoice: 'background' });
                 setEquipmentMode('quickstart');
               }}
               className={`p-4 rounded-lg border-2 transition-all text-left ${
                 backgroundChoice === 'background'
                   ? 'bg-accent-green-darker border-accent-green'
                   : 'bg-theme-tertiary border-theme-primary hover:border-theme-secondary'
               }`}
             >
               <h5 className="font-semibold text-accent-green-light mb-2">Background Equipment</h5>
               <p className="text-sm text-theme-tertiary mb-3">
                 Take the equipment provided by your background choice.
               </p>
               {(() => {
                  const background = BACKGROUNDS.find(bg => bg.slug === data.background);
                 return background?.equipment ? (
                   <div className="space-y-1">
                     <div className="text-xs font-medium text-theme-muted uppercase">Equipment:</div>
                     {background.equipment.map((item: string, index: number) => (
                       <div key={index} className="text-sm text-theme-primary flex items-center">
                         <span className="text-accent-yellow-light mr-2">•</span>
                         {item}
                       </div>
                     ))}
                   </div>
                 ) : (
                   <div className="text-sm text-theme-muted">No equipment specified</div>
                 );
               })()}
             </button>

             {/* Gold Alternative Option */}
             <button
               onClick={() => {
                 setBackgroundChoice('gold');
                 updateData({ equipmentChoice: 'gold', equipmentGold: 50 });
                 setEquipmentMode('buy');
               }}
               className={`p-4 rounded-lg border-2 transition-all text-left ${
                 backgroundChoice === 'gold'
                   ? 'bg-accent-blue-darker border-accent-blue'
                   : 'bg-theme-tertiary border-theme-primary hover:border-theme-secondary'
               }`}
             >
               <h5 className="font-semibold text-accent-blue-light mb-2">50 GP to Spend</h5>
               <p className="text-sm text-theme-tertiary mb-3">
                 Exchange your background equipment for 50 gold pieces to spend in the shop.
               </p>
               <div className="space-y-1">
                 <div className="text-xs font-medium text-theme-muted uppercase">Benefits:</div>
                 <div className="text-sm text-theme-primary flex items-center">
                   <span className="text-accent-yellow-light mr-2">•</span>
                   Maximum equipment flexibility
                 </div>
                 <div className="text-sm text-theme-primary flex items-center">
                   <span className="text-accent-yellow-light mr-2">•</span>
                   Choose exactly what you want
                 </div>
                 <div className="text-sm text-theme-primary flex items-center">
                   <span className="text-accent-yellow-light mr-2">•</span>
                   Access to rare or specialized items
                 </div>
               </div>
             </button>
           </div>
         </div>
       ) : (
         <div className="bg-theme-secondary/50 border border-theme-primary rounded-lg p-4 space-y-4">
           <h4 className="text-lg font-bold text-accent-yellow-light">
             {data.edition === '2024' ? 'Equipment Package' : 'Choose Equipment Method'}
           </h4>
           <p className="text-sm text-theme-muted">
             {data.edition === '2024'
               ? 'In 2024 rules, you receive a standard equipment package based on your class and background choices.'
               : 'Select how you want to equip your character. Quick Start gives you a curated loadout, while Buy Equipment lets you spend starting wealth on custom gear.'
             }
           </p>

           <div className={`grid grid-cols-1 ${data.edition === '2024' ? 'md:grid-cols-1' : 'md:grid-cols-3'} gap-3`}>
             <button
               onClick={() => setEquipmentMode('quickstart')}
               className={`p-4 rounded-lg border-2 transition-all text-left ${
                 equipmentMode === 'quickstart'
                   ? 'bg-accent-green-darker border-accent-green'
                   : 'bg-theme-tertiary border-theme-primary hover:border-theme-secondary'
               }`}
             >
               <h5 className="font-semibold text-accent-green-light mb-2">
                 {data.edition === '2024' ? 'Standard Equipment Package' : 'Quick Start Loadout'}
               </h5>
               <p className="text-sm text-theme-tertiary">
                 {data.edition === '2024'
                   ? 'Get the standard equipment package for your class and background as defined in the 2024 rules.'
                   : 'Get a curated set of equipment perfectly suited for your class and background. Recommended for beginners.'
                 }
               </p>
             </button>

            {data.edition !== '2024' && (
              <>
                <button
                  onClick={() => setEquipmentMode('buy')}
                  className={`p-4 rounded-lg border-2 transition-all text-left ${
                    equipmentMode === 'buy'
                      ? 'bg-accent-blue-darker border-accent-blue'
                      : 'bg-theme-tertiary border-theme-primary hover:border-theme-secondary'
                  }`}
                >
                  <h5 className="font-semibold text-accent-blue-light mb-2">Buy Equipment</h5>
                  <p className="text-sm text-theme-tertiary">
                    Roll for starting wealth and spend it in the shop. Maximum flexibility for advanced players.
                  </p>
                </button>

                <button
                  onClick={() => setEquipmentMode('choices')}
                  className={`p-4 rounded-lg border-2 transition-all text-left ${
                    equipmentMode === 'choices'
                      ? 'bg-accent-purple-darker border-accent-purple'
                      : 'bg-theme-tertiary border-theme-primary hover:border-theme-secondary'
                  }`}
                >
                  <h5 className="font-semibold text-accent-purple-light mb-2">Custom Choices</h5>
                  <p className="text-sm text-theme-tertiary">
                    Make individual equipment selections from your class options. Full control over every item.
                  </p>
                </button>
              </>
            )}
          </div>
         </div>
       )}

       {/* Equipment Content Based on Mode */}
       {equipmentMode === 'quickstart' && (
         <QuickStartEquipment
           classSlug={data.classSlug}
           backgroundName={data.background}
           onAccept={() => {
             let startingInventory: Array<{equipmentSlug: string, quantity: number, equipped: boolean}>;

             if (data.equipmentChoice === 'background' && data.edition === '2024') {
               // Use only background equipment for 2024 background choice
                const background = BACKGROUNDS.find(bg => bg.slug === data.background);
               if (background?.equipment) {
                 startingInventory = background.equipment.map(itemName => {
                   // Try to find the equipment item by name
                   const equipmentItem = EQUIPMENT_PACKAGES.flatMap(pkg => pkg.items)
                     .find(item => item.name.toLowerCase() === itemName.toLowerCase());
                   return {
                     equipmentSlug: equipmentItem?.slug || `custom-${itemName.toLowerCase().replace(/\s+/g, '-')}`,
                     quantity: 1,
                     equipped: false
                   };
                 });
               } else {
                 startingInventory = [];
               }
             } else {
               // Generate and save QuickStart equipment to startingInventory
               const quickStartEquipment = generateQuickStartEquipment(data.classSlug, data.background);
               startingInventory = quickStartEquipment.items.map(item => ({
                 equipmentSlug: item.equipmentSlug,
                 quantity: item.quantity,
                 equipped: item.equipped || false
               }));
             }

             updateData({ startingInventory });

             // Skip to traits/finalize step
             if (skipToStep) {
               skipToStep(13);
             } else {
               nextStep();
             }
           }}
           onBuyInstead={() => setEquipmentMode('buy')}
         />
       )}

      {equipmentMode === 'buy' && (
        <div className="space-y-4">
          {!goldRolled ? (
            <div className="bg-theme-tertiary/50 border border-theme-primary rounded-lg p-4 space-y-4">
              <h4 className="text-lg font-bold text-accent-yellow-light">Roll Starting Wealth</h4>
              <p className="text-sm text-theme-muted">
                Roll dice to determine your starting gold pieces. You can also take the average amount.
              </p>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    const rolledGold = rollStartingWealth(data.classSlug);
                    setStartingGold(rolledGold);
                    setGoldRolled(true);
                  }}
                  className="px-4 py-2 bg-accent-purple hover:bg-accent-purple-light rounded-lg text-white font-medium"
                >
                  Roll for Gold
                </button>
                <button
                  onClick={() => {
                    const averageGold = rollStartingWealth(data.classSlug); // This will return average
                    setStartingGold(averageGold);
                    setGoldRolled(true);
                  }}
                  className="px-4 py-2 bg-accent-blue hover:bg-accent-blue-dark rounded-lg text-white font-medium"
                >
                  Take Average
                </button>
              </div>
            </div>
          ) : (
            <EquipmentShop
              startingGold={startingGold}
              onPurchaseComplete={(_purchasedItems: PurchasedItem[]) => {
                // Handle purchased equipment
              }}
              onBack={() => setEquipmentMode('quickstart')}
            />
          )}
        </div>
      )}

      {/* Equipment Choices - Only show in custom mode */}
      {equipmentMode === 'choices' && (
        <>
          <div className="bg-theme-secondary/50 border border-theme-primary rounded-lg p-4">
            <h4 className="text-lg font-bold text-accent-purple-light mb-2">Custom Equipment Selection</h4>
            <p className="text-sm text-theme-muted">
              Make your equipment choices from the options available to your class.
            </p>
          </div>

          {/* Equipment Choices */}
          {(data.equipmentChoices || []).map((choice, idx) => (
        <div key={choice.choiceId} className="bg-theme-tertiary/50 border border-theme-primary rounded-lg p-4 space-y-3">
          <h4 className="font-semibold text-accent-yellow-light">
            {idx + 1}. {choice.description}
          </h4>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {choice.options.map((option, optionIdx) => {
              // Check if this option contains an equipment pack
              const packOption = option.find(item =>
                EQUIPMENT_PACKAGES.some(pack => pack.name === item.name)
              );
              const pack = packOption ? EQUIPMENT_PACKAGES.find(p => p.name === packOption.name) : null;

              if (pack) {
                // Display as expandable pack
                return (
                  <EquipmentPackDisplay
                    key={optionIdx}
                    pack={pack}
                    isSelected={choice.selected === optionIdx}
                    onClick={() => handleEquipmentChoice(choice.choiceId, optionIdx)}
                    showRecommendation={true}
                    characterClass={data.classSlug}
                  />
                );
              } else {
                // Display as regular equipment option
                return (
                  <button
                    key={optionIdx}
                    onClick={() => handleEquipmentChoice(choice.choiceId, optionIdx)}
                    className={`p-3 rounded-lg border-2 text-left transition-all ${
                      choice.selected === optionIdx
                        ? 'bg-accent-blue-darker border-blue-500'
                        : 'bg-theme-tertiary border-theme-primary hover:bg-theme-quaternary'
                    }`}
                  >
                    <div className="space-y-1">
                      {option.map((item, itemIdx) => (
                        <div key={itemIdx} className="text-sm">
                          <span className="text-white font-medium">{item.name}</span>
                          {item.quantity > 1 && (
                            <span className="text-theme-muted ml-1">x{item.quantity}</span>
                          )}
                          {item.weight && item.weight > 0 && (
                            <span className="text-theme-disabled text-xs ml-2">({item.weight} lb)</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </button>
                );
              }
            })}
          </div>
        </div>
      ))}
        </>
      )}

      {/* Background Equipment Info */}
      {(() => {
        const backgroundData = BACKGROUNDS.find(bg => bg.name === data.background);
        if (backgroundData?.equipment) {
          return (
            <div className="p-3 bg-accent-green-darker/20 border border-accent-green-dark rounded-lg">
              <div className="text-xs font-semibold text-accent-green-light mb-2">
                Background Equipment (Auto-granted from {data.background}):
              </div>
              <div className="space-y-1">
                {Array.isArray(backgroundData.equipment)
                  ? backgroundData.equipment.map((item, index) => (
                    <div key={index} className="text-sm text-theme-tertiary">• {item}</div>
                  ))
                  : <p className="text-sm text-theme-tertiary">{backgroundData.equipment}</p>
                }
              </div>
            </div>
          );
        }
        return null;
      })()}

       {!allChoicesMade && (
         <div className="text-xs text-accent-yellow-light">
           ⚠️ Please make all equipment choices before continuing
         </div>
       )}

        {/* Fighter Build Recommendations */}
        {selectedClass?.slug === 'fighter' && (
          <div className="bg-theme-tertiary/50 border border-theme-primary rounded-lg p-4 space-y-4">
            <h4 className="text-lg font-bold text-accent-yellow-light">Fighter Build Recommendations</h4>
            <p className="text-xs text-theme-muted">
              Choose your starting equipment based on your preferred playstyle. Each build optimizes for different combat roles.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Build 1: The Defender (Tank) */}
              <button
                onClick={() => handleFighterBuildSelect('defender')}
                className={`border-2 rounded-lg p-3 text-left transition-all ${
                  selectedFighterBuild === 'defender'
                    ? 'bg-accent-green-darker border-accent-green'
                    : 'bg-green-900/10 border-accent-green hover:bg-green-900/20'
                }`}
              >
                <h5 className="font-semibold text-accent-green-light text-sm">The Defender (Tank)</h5>
                <p className="text-xs text-theme-tertiary mt-1">Highest possible Armor Class from level 1. You are the party's protector.</p>
                <div className="text-xs text-theme-muted mt-2">
                  <p className="text-accent-yellow-light font-medium">Result: 18 AC, solid melee weapon, ranged backup</p>
                </div>
              </button>

              {/* Build 2: The Striker (Two-Handed Damage) */}
              <button
                onClick={() => handleFighterBuildSelect('striker')}
                className={`border-2 rounded-lg p-3 text-left transition-all ${
                  selectedFighterBuild === 'striker'
                    ? 'bg-accent-red-darker border-accent-red'
                    : 'bg-red-900/10 border-accent-red hover:bg-red-900/20'
                }`}
              >
                <h5 className="font-semibold text-accent-red-light text-sm">The Striker (Two-Handed Damage)</h5>
                <p className="text-xs text-theme-tertiary mt-1">Maximum damage output, sacrificing some AC for power.</p>
                <div className="text-xs text-theme-muted mt-2">
                  <p className="text-accent-yellow-light font-medium">Result: 16 AC, highest damage dice, ranged backups</p>
                </div>
              </button>

              {/* Build 3: The Archer (Dexterity-Based) */}
              <button
                onClick={() => handleFighterBuildSelect('archer')}
                className={`border-2 rounded-lg p-3 text-left transition-all ${
                  selectedFighterBuild === 'archer'
                    ? 'bg-accent-blue-darker border-accent-blue'
                    : 'bg-blue-900/10 border-accent-blue hover:bg-blue-900/20'
                }`}
              >
                <h5 className="font-semibold text-accent-blue-light text-sm">The Archer (Dexterity-Based)</h5>
                <p className="text-xs text-theme-tertiary mt-1">Ranged combat specialist using high Dexterity.</p>
                <div className="text-xs text-theme-muted mt-2">
                  <p className="text-accent-yellow-light font-medium">Result: 14 AC, best bow, finesse melee option</p>
                </div>
              </button>
            </div>

            {/* Build 4: Gold Option - Info only */}
            <div className="border border-accent-yellow rounded-lg p-3 bg-yellow-900/10">
              <h5 className="font-semibold text-accent-yellow-light text-sm">💡 Pro-Tip: The Gold Option</h5>
              <p className="text-xs text-theme-tertiary mt-1">Take starting gold instead of equipment for maximum flexibility.</p>
              <div className="text-xs text-theme-muted mt-2 space-y-1">
                <p><strong>Average Gold:</strong> 175 gp (5d4 × 10)</p>
                <p><strong>Can Buy:</strong> Chain Mail (50 gp) + Greatsword (50 gp) + 2 Handaxes (10 gp) + Dungeoneer's Pack (12 gp)</p>
                <p><strong>Remaining:</strong> 53 gp for javelins, potions, etc.</p>
                <p className="text-accent-yellow-light font-medium mt-2">Advantage: More flexibility, potentially better gear</p>
              </div>
            </div>

            {selectedFighterBuild && (
              <div className="text-xs text-accent-green-light text-center">
                ✅ {fighterBuilds[selectedFighterBuild as keyof typeof fighterBuilds].name} build selected - equipment choices have been automatically set above
              </div>
            )}
          </div>
        )}

        {/* Trinket Roller */}
        <TrinketRoller
          onTrinketSelected={(trinket) => {
            updateData({ selectedTrinket: trinket });
            setRolledTrinket(trinket);
          }}
          initialTrinket={rolledTrinket}
        />

       <div className='flex justify-between items-center gap-3'>
        <button onClick={prevStep} className="px-4 py-2 bg-theme-quaternary hover:bg-theme-hover rounded-lg text-white flex items-center">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back
        </button>
        <button
          onClick={() => {
            if (!allChoicesMade) {
              const missing = getMissingEquipmentChoices(data.equipmentChoices || []);
              setMissingChoices(missing);
              setShowMissingChoicesModal(true);
            } else {
              nextStep();
            }
          }}
          className="px-4 py-2 bg-accent-yellow-dark hover:bg-accent-yellow rounded-lg text-white flex items-center"
        >
          {getNextStepLabel?.() || 'Continue'} <ArrowRight className="w-4 h-4 ml-2" />
        </button>
        <button
          onClick={() => {
            if (!allChoicesMade) {
              const missing = getMissingEquipmentChoices(data.equipmentChoices || []);
              setMissingChoices(missing);
              setShowMissingChoicesModal(true);
            } else if (skipToStep) {
              skipToStep(13); // Skip to Traits/Final details step
            }
          }}
          className="px-4 py-2 bg-accent-red hover:bg-accent-red-light rounded-lg text-white flex items-center"
        >
          Skip to Traits <ArrowRight className="w-4 h-4 ml-2" />
        </button>
      </div>

      {/* Missing Choices Modal */}
      {showMissingChoicesModal && (
        <div className="fixed inset-0 backdrop-blur-md flex items-center justify-center z-50">
          <div className="bg-theme-secondary border border-theme-primary rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-bold text-accent-yellow-light mb-4">
              Equipment Choices Incomplete
            </h3>
            <p className="text-sm text-theme-tertiary mb-4">
              You still need to make the following equipment choice{missingChoices.length > 1 ? 's' : ''}:
            </p>
            <ul className="text-sm text-theme-muted mb-6 space-y-1">
              {missingChoices.map(choiceNum => (
                <li key={choiceNum} className="flex items-center">
                  <span className="text-accent-yellow-light mr-2">•</span>
                  Choice {choiceNum}
                </li>
              ))}
            </ul>
            <div className="flex justify-end">
              <button
                onClick={() => setShowMissingChoicesModal(false)}
                className="px-4 py-2 bg-accent-blue hover:bg-accent-blue-dark rounded-lg text-white font-medium"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};