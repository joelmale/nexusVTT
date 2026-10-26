import { useCreationSession } from '../../hooks/useCreationSession';
import { evaluateDraft } from '../../services/draftEvaluator';
import { generateFirstTurnGuidance } from '../../services/guidanceService';
import { draftToCreationData } from '../../adapters/draftAdapter';
import React, { useState, useMemo } from 'react';
import {
  Shield,
  Crosshair,
  Eye,
  Wand2,
  Sparkles,
  ArrowLeft,
  ArrowRight,
  Dices,
  Check,
  Edit2,
} from 'lucide-react';
import type { CharacterCreationData, Edition } from '../../types/dnd';
import {
  getRecommendation,
  CombatIntent,
  RecommendationResult,
} from '../../services/recommendationService';
import { CERTIFIED_SUPPORT_MANIFEST } from '../../data/supportManifest';
import { getAllSpecies } from '../../services/dataService';
import { generateRandomName } from '../../utils/randomCharacterGenerator';
import AbilityScoreEditModal from './AbilityScoreEditModal';
import SkillEditModal from './SkillEditModal';
import SpellEditModal from './SpellEditModal';
import { CastingGrantChoices } from '../CastingGrantChoices';
import type { CreationDraft, CreatorPresentation } from '../../types/draft';
import { studyRecorder } from '../../services/studyRecorder';

export interface FourScreenNewcomerFlowProps {
  isOpen: boolean;
  edition: Edition;
  onClose: () => void;
  onComplete: (characterData: CharacterCreationData) => void;
  onSwitchToFullWizard?: () => void;
  onSwitchToQuiz?: () => void;
  initialDraft?: CreationDraft;
  initialPresentation?: CreatorPresentation;
  onPresentationChange?: (presentation: CreatorPresentation) => void;
  onDraftChange?: (draft: CreationDraft) => void;
  onDraftDiscard?: () => void;
  backLabel?: string;
}

const INTENT_OPTIONS: Array<{
  id: CombatIntent;
  title: string;
  description: string;
  icon: React.ReactNode;
}> = [
  {
    id: 'close_combat',
    title: 'Close Combat',
    description:
      'Armored warrior charging to the frontline with sword and shield.',
    icon: <Shield className="w-6 h-6 text-accent-red-light" />,
  },
  {
    id: 'archery',
    title: 'Ranged Archery',
    description: 'Snipe targets with bows from a safe tactical distance.',
    icon: <Crosshair className="w-6 h-6 text-accent-green-light" />,
  },
  {
    id: 'sneak',
    title: 'Sneak & Skills',
    description:
      'Infiltrate shadows, pick locks, and strike with Sneak Attack.',
    icon: <Eye className="w-6 h-6 text-accent-purple-light" />,
  },
  {
    id: 'cast',
    title: 'Arcane Magic',
    description:
      'Wield firebolts, protective shields, and versatile spell utility.',
    icon: <Wand2 className="w-6 h-6 text-accent-blue-light" />,
  },
  {
    id: 'support',
    title: 'Divine Support',
    description: 'Heal wounded allies, buff teammates, and smite adversaries.',
    icon: <Sparkles className="w-6 h-6 text-accent-gold-light" />,
  },
];

const ALIGNMENTS = [
  { value: 'Neutral Good', label: 'Neutral Good (Helpful & Kind)' },
  { value: 'Lawful Good', label: 'Lawful Good (Honor & Duty)' },
  { value: 'Chaotic Good', label: 'Chaotic Good (Free Spirit & Kind)' },
  { value: 'True Neutral', label: 'True Neutral (Pragmatic & Balanced)' },
  { value: 'Lawful Neutral', label: 'Lawful Neutral (Order & Law)' },
  { value: 'Chaotic Neutral', label: 'Chaotic Neutral (Independent)' },
];

export const FourScreenNewcomerFlow: React.FC<FourScreenNewcomerFlowProps> = ({
  isOpen,
  edition,
  onClose,
  onComplete,
  onSwitchToFullWizard,
  onSwitchToQuiz,
  initialDraft,
  initialPresentation,
  onPresentationChange,
  onDraftChange,
  backLabel = 'Back',
}) => {
  const session = useCreationSession({ initialDraft, edition, onDraftChange });
  // Screen index: 0 = Intent, 1 = Recommended Hero, 2 = Equipment & Spells, 3 = Finalization
  const [screen, setScreen] = useState<number>(
    initialPresentation?.guidedFlow === 'four-screen'
      ? initialPresentation.step || 0
      : 0,
  );

  // Screen 1 choices
  const [selectedIntent, setSelectedIntent] =
    useState<CombatIntent>('close_combat');
  const [explicitClass, setExplicitClass] = useState<string | null>(
    initialDraft?.classSlug || null,
  );
  const [selectedSpecies, setSelectedSpecies] = useState<string>(
    initialDraft?.speciesSlug || '',
  );

  // Screen 4 choices
  const [characterName, setCharacterName] = useState<string>(
    initialDraft?.name || '',
  );
  const [selectedAlignment, setSelectedAlignment] = useState<string>(
    session.data.alignment || 'Neutral Good',
  );

  // Customization modals (CC-403 continuity)
  const [showAbilityModal, setShowAbilityModal] = useState(false);
  const [showSkillModal, setShowSkillModal] = useState(false);
  const [showSpellModal, setShowSpellModal] = useState(false);

  React.useEffect(() => {
    studyRecorder.recordEvent('flow_enter', 0);
  }, []);

  // Available species in this edition
  const availableSpecies = useMemo(() => {
    return getAllSpecies().filter((s) => s.edition === edition);
  }, [edition]);

  const generated = useMemo(
    () =>
      getRecommendation({
        intent: explicitClass ? undefined : selectedIntent,
        classSlug: explicitClass || undefined,
        speciesSlug: selectedSpecies || undefined,
        edition,
      }),
    [selectedIntent, explicitClass, selectedSpecies, edition],
  );
  const firstRecommendation = React.useRef(true);
  React.useEffect(() => {
    if (firstRecommendation.current && session.draft.classSlug) {
      firstRecommendation.current = false;
      return;
    }
    firstRecommendation.current = false;
    session.replaceRecommended(generated.draft);
  }, [generated]);
  React.useEffect(() => {
    onPresentationChange?.({
      mode: 'guided',
      guidedFlow: 'four-screen',
      step: screen,
    });
  }, [screen, onPresentationChange]);
  const activeDraft = session.draft.classSlug ? session.draft : generated.draft;
  const recommendation: RecommendationResult = {
    ...generated,
    draft: activeDraft,
    evaluation: evaluateDraft(activeDraft),
    firstTurnGuidance: generateFirstTurnGuidance(activeDraft),
  };
  const activeAbilities = activeDraft.rawAbilityScores;
  const activeSkills = activeDraft.skills;

  // Practical strengths derived from class and stats
  const practicalStrengths = useMemo(() => {
    const cls = recommendation.draft.classSlug?.toLowerCase();
    if (cls === 'fighter') {
      return [
        {
          title: 'Battle Hardened',
          desc: 'High hit points and Second Wind to recover health as a bonus action.',
        },
        {
          title: 'Heavy Protection',
          desc: 'Defense fighting style and armor make you difficult to hit.',
        },
        {
          title: 'Deadly Weapons',
          desc: 'Mastery over versatile weaponry to control and punish foes.',
        },
      ];
    }
    if (cls === 'rogue') {
      return [
        {
          title: 'Sneak Attack',
          desc: 'Deals devastating bonus damage when attacking with advantage or an ally.',
        },
        {
          title: 'Unmatched Expertise',
          desc: 'Double proficiency bonus on Stealth and Sleight of Hand.',
        },
        {
          title: 'Nimble Evasion',
          desc: 'High Dexterity to dodge hazards, pick locks, and stay undetected.',
        },
      ];
    }
    if (cls === 'wizard') {
      return [
        {
          title: 'Arcane Mastery',
          desc: 'Flexible spellbook with 6 starting spells covering offense and utility.',
        },
        {
          title: 'Life-Saving Shield',
          desc: 'Reaction spell that adds +5 AC to deflect incoming attacks.',
        },
        {
          title: 'Reliable Firepower',
          desc: 'Magic Missile strikes automatically without needing an attack roll.',
        },
      ];
    }
    return [
      {
        title: 'Versatile Toolkit',
        desc: 'Balanced capabilities ready for both combat and exploration.',
      },
      {
        title: 'Team Synergy',
        desc: 'Provides vital support and focus-fire coordination in combat.',
      },
      {
        title: 'Dedicated Focus',
        desc: 'Specialized features granting an edge in your party role.',
      },
    ];
  }, [recommendation.draft.classSlug]);

  const handleCreate = () => {
    const finalName = characterName.trim() || 'Hero';

    const creationData = {
      ...draftToCreationData(activeDraft),
      name: finalName,
      alignment: selectedAlignment,
    };
    onComplete(creationData);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-theme-primary bg-opacity-90 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-theme-secondary border border-theme-quaternary rounded-xl shadow-2xl max-w-3xl w-full max-h-[92vh] flex flex-col overflow-hidden">
        {/* Navigation / Header */}
        <div className="p-4 md:px-6 border-b border-theme-quaternary flex items-center justify-between bg-theme-tertiary">
          <button
            onClick={screen === 0 ? onClose : () => setScreen((s) => s - 1)}
            className="flex items-center space-x-2 px-3 py-1.5 bg-theme-quaternary hover:bg-theme-quaternary/80 rounded-lg text-white text-sm transition-colors min-h-[44px]"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{screen === 0 ? backLabel : 'Back'}</span>
          </button>

          {/* Stepper Dots */}
          <div className="flex items-center space-x-2">
            {[0, 1, 2, 3].map((stepIdx) => (
              <div
                key={stepIdx}
                className={`w-3 h-3 rounded-full transition-colors ${
                  screen === stepIdx
                    ? 'bg-accent-purple ring-2 ring-accent-purple-light'
                    : screen > stepIdx
                      ? 'bg-accent-purple-dark'
                      : 'bg-theme-quaternary'
                }`}
              />
            ))}
            <span className="text-xs text-theme-muted ml-2 font-medium">
              Screen {screen + 1} of 4
            </span>
          </div>

          <div className="flex items-center space-x-2">
            {onSwitchToFullWizard && (
              <button
                onClick={onSwitchToFullWizard}
                className="text-xs text-accent-purple-light hover:underline min-h-[44px] px-2 flex items-center"
              >
                Advanced Mode
              </button>
            )}
            <button
              onClick={onClose}
              className="text-theme-muted hover:text-white p-2 min-h-[44px] min-w-[44px] flex items-center justify-center"
              aria-label="Close"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
          {/* ==================== SCREEN 1: INTENT & HERO ==================== */}
          {screen === 0 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-white mb-1">
                  How do you want to play?
                </h2>
                <p className="text-sm text-theme-muted">
                  Choose a style below or pick a class directly. We'll build a
                  ready-to-play level 1 character with optimal choices.
                </p>
              </div>

              {/* 5 Playstyle Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {INTENT_OPTIONS.map((intent) => {
                  const isSelected =
                    !explicitClass && selectedIntent === intent.id;
                  return (
                    <button
                      key={intent.id}
                      onClick={() => {
                        setSelectedIntent(intent.id);
                        setExplicitClass(null);
                      }}
                      className={`text-left p-4 rounded-xl border transition-all min-h-[64px] flex items-start space-x-3 ${
                        isSelected
                          ? 'border-accent-purple bg-accent-purple/10 ring-2 ring-accent-purple'
                          : 'border-theme-quaternary bg-theme-tertiary hover:border-theme-muted'
                      }`}
                    >
                      <div className="p-2 bg-theme-primary rounded-lg shrink-0">
                        {intent.icon}
                      </div>
                      <div>
                        <h3 className="font-semibold text-white">
                          {intent.title}
                        </h3>
                        <p className="text-xs text-theme-muted mt-0.5">
                          {intent.description}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Quick Class Bypass */}
              <div className="pt-2 border-t border-theme-quaternary">
                <span className="text-xs font-semibold text-theme-muted uppercase tracking-wider block mb-2">
                  Or bypass quiz directly:
                </span>
                <div className="flex flex-wrap gap-2">
                  {CERTIFIED_SUPPORT_MANIFEST.map((cert) => {
                    const isSelected = explicitClass === cert.classSlug;
                    return (
                      <button
                        key={cert.classSlug}
                        onClick={() => {
                          setExplicitClass(cert.classSlug);
                        }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors min-h-[44px] flex items-center ${
                          isSelected
                            ? 'bg-accent-purple border-accent-purple text-white'
                            : 'bg-theme-tertiary border-theme-quaternary text-theme-muted hover:text-white hover:border-theme-muted'
                        }`}
                      >
                        {cert.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Optional Species Selector */}
              <div className="pt-2 border-t border-theme-quaternary flex flex-col md:flex-row md:items-center justify-between gap-2">
                <div>
                  <label
                    htmlFor="species-select"
                    className="text-xs font-semibold text-theme-muted uppercase tracking-wider block"
                  >
                    Desired Species (Optional):
                  </label>
                  <span className="text-xs text-theme-muted">
                    Defaults to optimal recommendation for your playstyle.
                  </span>
                </div>
                <select
                  id="species-select"
                  value={selectedSpecies}
                  onChange={(e) => setSelectedSpecies(e.target.value)}
                  className="bg-theme-tertiary border border-theme-quaternary rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent-purple min-h-[44px]"
                >
                  <option value="">Recommended Match</option>
                  {availableSpecies.map((s) => (
                    <option key={s.slug} value={s.slug}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              {onSwitchToQuiz && (
                <div className="text-center pt-2">
                  <button
                    onClick={onSwitchToQuiz}
                    className="text-xs text-theme-muted hover:text-accent-purple-light underline min-h-[44px]"
                  >
                    Want to take the in-depth personality quiz instead?
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ==================== SCREEN 2: RECOMMENDED HERO ==================== */}
          {screen === 1 && (
            <div className="space-y-6">
              {/* Hero Banner */}
              <div className="bg-theme-tertiary border border-theme-quaternary rounded-xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <span className="text-xs text-accent-purple-light font-bold uppercase tracking-wider">
                    Recommended Character
                  </span>
                  <h2 className="text-3xl font-extrabold text-white mt-1">
                    {recommendation.draft.classSlug?.toUpperCase()} •{' '}
                    <span className="text-theme-muted font-normal text-2xl">
                      {recommendation.draft.speciesSlug?.replace(/-2024$/, '')}
                    </span>
                  </h2>
                  <p className="text-sm text-theme-muted mt-1">
                    Background:{' '}
                    {recommendation.draft.backgroundSlug?.replace(/-2024$/, '')}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowAbilityModal(true)}
                    className="px-3 py-1.5 bg-theme-quaternary hover:bg-theme-quaternary/80 rounded-lg text-xs font-semibold text-white flex items-center space-x-1.5 min-h-[44px]"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>Customize Stats</span>
                  </button>
                  <button
                    onClick={() => setShowSkillModal(true)}
                    className="px-3 py-1.5 bg-theme-quaternary hover:bg-theme-quaternary/80 rounded-lg text-xs font-semibold text-white flex items-center space-x-1.5 min-h-[44px]"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>Customize Skills</span>
                  </button>
                </div>
              </div>

              {/* Three Practical Strengths */}
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-3">
                  Key Strengths in Play
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {practicalStrengths.map((str, idx) => (
                    <div
                      key={idx}
                      className="bg-theme-tertiary border border-theme-quaternary rounded-lg p-3.5 space-y-1"
                    >
                      <h4 className="font-semibold text-white text-sm flex items-center space-x-1.5">
                        <Check className="w-4 h-4 text-accent-green-light shrink-0" />
                        <span>{str.title}</span>
                      </h4>
                      <p className="text-xs text-theme-muted">{str.desc}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Core Attributes & Skills */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-theme-tertiary border border-theme-quaternary rounded-lg p-4">
                  <h4 className="text-xs font-bold text-theme-muted uppercase tracking-wider mb-2">
                    Ability Scores
                  </h4>
                  <div className="grid grid-cols-3 gap-2">
                    {Object.entries(activeAbilities).map(([ability, score]) => (
                      <div
                        key={ability}
                        className="bg-theme-primary rounded p-2 text-center"
                      >
                        <span className="text-[11px] text-theme-muted block font-bold">
                          {ability}
                        </span>
                        <span className="text-lg font-bold text-white">
                          {score}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-theme-tertiary border border-theme-quaternary rounded-lg p-4">
                  <h4 className="text-xs font-bold text-theme-muted uppercase tracking-wider mb-2">
                    Trained Skills
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {activeSkills.map((sk) => (
                      <span
                        key={sk}
                        className="px-2.5 py-1 bg-theme-primary border border-theme-quaternary rounded text-xs font-medium text-white"
                      >
                        {sk}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ==================== SCREEN 3: EQUIPMENT & SPELLS ==================== */}
          {screen === 2 && (
            <div className="space-y-6">
              <CastingGrantChoices
                data={session.data}
                onChange={session.updateData}
              />
              <div>
                <h2 className="text-2xl font-bold text-white mb-1">
                  Equipment & Spell Package
                </h2>
                <p className="text-sm text-theme-muted">
                  Review your equipment and spells before saving.
                </p>
              </div>

              {/* Equipment Items */}
              <div className="bg-theme-tertiary border border-theme-quaternary rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-white text-sm uppercase tracking-wider">
                    Starting Loadout & Currency
                  </h3>
                  <span className="text-xs font-bold text-accent-gold-light">
                    {recommendation.draft.loadout.currency.gp} gp in pouch
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {recommendation.draft.loadout.items.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-2 bg-theme-primary border border-theme-quaternary rounded-lg text-xs"
                    >
                      <span className="text-white font-medium capitalize">
                        {item.quantity} � {item.name}
                      </span>
                      {item.equipped && (
                        <span className="text-[10px] bg-accent-purple/20 text-accent-purple-light px-1.5 py-0.5 rounded font-bold">
                          Equipped
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Starter Spells (if applicable) */}
              {recommendation.draft.spells &&
                (recommendation.draft.spells.cantrips.length > 0 ||
                  recommendation.draft.spells.prepared.length > 0) && (
                  <div className="bg-theme-tertiary border border-theme-quaternary rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-white text-sm uppercase tracking-wider">
                        Prepared Spells & Cantrips
                      </h3>
                      <button
                        onClick={() => setShowSpellModal(true)}
                        className="text-xs text-accent-purple-light hover:underline flex items-center space-x-1"
                      >
                        <Edit2 className="w-3 h-3" />
                        <span>Swap Spells</span>
                      </button>
                    </div>

                    <div className="space-y-2">
                      <span className="text-xs font-semibold text-theme-muted block">
                        Cantrips (At Will):
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {recommendation.draft.spells.cantrips.map((c) => (
                          <span
                            key={c}
                            className="px-2.5 py-1 bg-theme-primary border border-theme-quaternary rounded text-xs text-accent-blue-light font-medium capitalize"
                          >
                            {c.replace(/-/g, ' ')}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2 pt-2 border-t border-theme-quaternary">
                      <span className="text-xs font-semibold text-theme-muted block">
                        Prepared Level 1 Spells:
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {recommendation.draft.spells.prepared.map((p) => (
                          <span
                            key={p}
                            className="px-2.5 py-1 bg-theme-primary border border-theme-quaternary rounded text-xs text-accent-purple-light font-medium capitalize"
                          >
                            {p.replace(/-/g, ' ')}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
            </div>
          )}

          {/* ==================== SCREEN 4: FINALIZATION ==================== */}
          {screen === 3 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-white mb-1">
                  Name & Finalize
                </h2>
                <p className="text-sm text-theme-muted">
                  Give your hero an identity and review your first turn in
                  combat.
                </p>
              </div>

              {/* Name & Alignment Row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label
                    htmlFor="char-name"
                    className="text-xs font-bold text-theme-muted uppercase tracking-wider"
                  >
                    Character Name
                  </label>
                  <div className="flex space-x-2">
                    <input
                      id="char-name"
                      type="text"
                      value={characterName}
                      onChange={(e) => {
                        setCharacterName(e.target.value);
                        session.updateData({ name: e.target.value });
                      }}
                      placeholder="Enter a name..."
                      className="flex-1 bg-theme-tertiary border border-theme-quaternary rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent-purple min-h-[44px]"
                    />
                    <button
                      onClick={() =>
                        setCharacterName(
                          generateRandomName(
                            recommendation.draft.speciesSlug || 'Human',
                            edition,
                          ),
                        )
                      }
                      title="Randomize Name"
                      className="px-3 py-2 bg-theme-quaternary hover:bg-theme-quaternary/80 rounded-lg text-white transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                    >
                      <Dices className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="alignment-select"
                    className="text-xs font-bold text-theme-muted uppercase tracking-wider"
                  >
                    Alignment
                  </label>
                  <select
                    id="alignment-select"
                    value={selectedAlignment}
                    onChange={(e) => {
                      setSelectedAlignment(e.target.value);
                      session.updateData({ alignment: e.target.value });
                    }}
                    className="w-full bg-theme-tertiary border border-theme-quaternary rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent-purple min-h-[44px]"
                  >
                    {ALIGNMENTS.map((al) => (
                      <option key={al.value} value={al.value}>
                        {al.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* First-Turn Guidance Card (CC-303 / CC-504) */}
              <div className="bg-theme-tertiary border border-theme-quaternary rounded-xl p-4 space-y-3">
                <h3 className="text-xs font-bold text-accent-gold-light uppercase tracking-wider flex items-center space-x-1.5">
                  <Sparkles className="w-4 h-4" />
                  <span>First-Turn Combat Guidance</span>
                </h3>

                <div className="space-y-2 text-xs">
                  <div>
                    <span className="font-bold text-white block">
                      Standard Action:
                    </span>
                    <span className="text-theme-muted">
                      {recommendation.firstTurnGuidance.standardAction}
                    </span>
                  </div>
                  {recommendation.firstTurnGuidance.bonusAction && (
                    <div>
                      <span className="font-bold text-white block">
                        Bonus Action:
                      </span>
                      <span className="text-theme-muted">
                        {recommendation.firstTurnGuidance.bonusAction}
                      </span>
                    </div>
                  )}
                  {recommendation.firstTurnGuidance.reaction && (
                    <div>
                      <span className="font-bold text-white block">
                        Reaction:
                      </span>
                      <span className="text-theme-muted">
                        {recommendation.firstTurnGuidance.reaction}
                      </span>
                    </div>
                  )}
                  <div className="p-2.5 bg-theme-primary/50 border border-theme-quaternary/50 rounded-lg">
                    <span className="font-bold text-accent-purple-light block mb-0.5">
                      Tactical Tip:
                    </span>
                    <span className="text-theme-muted">
                      {recommendation.firstTurnGuidance.tacticalTip}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 md:px-6 border-t border-theme-quaternary bg-theme-tertiary flex items-center justify-between">
          <span className="text-xs text-theme-muted">
            Edition: <span className="font-bold text-white">{edition}</span>
          </span>

          <div className="flex space-x-3">
            {screen < 3 ? (
              <button
                onClick={() => setScreen((s) => s + 1)}
                className="px-6 py-2.5 bg-accent-purple hover:bg-accent-purple-dark text-white font-semibold rounded-lg flex items-center space-x-2 transition-all min-h-[44px]"
              >
                <span>Continue</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={handleCreate}
                className="px-6 py-2.5 bg-accent-green hover:bg-accent-green-dark text-white font-bold rounded-lg flex items-center space-x-2 transition-all shadow-lg min-h-[44px]"
              >
                <span>Create Character</span>
                <Check className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Customization Modals */}
      {showAbilityModal && (
        <AbilityScoreEditModal
          isOpen={showAbilityModal}
          onClose={() => setShowAbilityModal(false)}
          currentScores={activeAbilities}
          onSave={(scores) => {
            session.updateData({
              abilities: scores as CharacterCreationData['abilities'],
            });
            setShowAbilityModal(false);
          }}
        />
      )}

      {showSkillModal && (
        <SkillEditModal
          isOpen={showSkillModal}
          onClose={() => setShowSkillModal(false)}
          currentSkills={activeSkills}
          onSave={(skills) => {
            session.updateData({
              selectedSkills: skills as CharacterCreationData['selectedSkills'],
            });
            setShowSkillModal(false);
          }}
          classSlug={recommendation.draft.classSlug || 'fighter'}
          backgroundSlug={recommendation.draft.backgroundSlug || 'soldier-2024'}
        />
      )}

      {showSpellModal && (
        <SpellEditModal
          isOpen={showSpellModal}
          onClose={() => setShowSpellModal(false)}
          classSlug={recommendation.draft.classSlug || 'wizard'}
          edition={recommendation.draft.edition}
          level={recommendation.draft.level}
          abilities={Object.fromEntries(
            Object.entries(
              recommendation.evaluation.calculatedCharacter?.abilities ?? {},
            ).map(([key, value]) => [key, value.score]),
          )}
          currentSelection={{
            selectedCantrips: recommendation.draft.spells?.cantrips || [],
            knownSpells: recommendation.draft.spells?.knownOrBook || [],
            spellbook:
              recommendation.draft.classSlug === 'wizard'
                ? recommendation.draft.spells.knownOrBook
                : undefined,
            preparedSpells: recommendation.draft.spells?.prepared || [],
          }}
          onSave={(sel) => {
            session.updateData({
              spellSelection: {
                ...session.data.spellSelection,
                ...sel,
                dailyPrepared: sel.dailyPrepared || sel.preparedSpells,
              },
            });
            setShowSpellModal(false);
          }}
        />
      )}
    </div>
  );
};
export default FourScreenNewcomerFlow;
