import React from 'react';
import { X, Star, Shield, Zap, Heart, Eye, Users, Mountain, BookOpen, Target, MessageCircle, Wrench, Music } from 'lucide-react';

interface SkillModalProps {
  skill: string;
  isOpen: boolean;
  onClose: () => void;
}

export const SkillModal: React.FC<SkillModalProps> = ({
  skill,
  isOpen,
  onClose,
}) => {
  if (!isOpen || !skill) return null;

  // Skill data based on D&D 5e rules
  const skillData: Record<string, {
    ability: string;
    description: string;
    typicalUses: string[];
    relatedFeats: string[];
    icon: React.ReactNode;
  }> = {
    "Acrobatics": {
      ability: "DEX",
      description: "Acrobatics measures your ability to stay on your feet in a tricky situation. It covers your attempts to stay on a slippery surface, balance on a narrow ledge, or somersault away from an enemy.",
      typicalUses: [
        "Maintaining balance on narrow or slippery surfaces",
        "Escaping from bonds or restraints",
        "Landing safely after a fall",
        "Moving through an enemy's space without provoking opportunity attacks",
        "Performing acrobatic stunts like flips and rolls"
      ],
      relatedFeats: ["Mobile", "Lucky", "Alert", "Athlete"],
      icon: <Target className="w-6 h-6" />
    },
    "Animal Handling": {
      ability: "WIS",
      description: "Animal Handling allows you to calm, train, or control animals and monsters. It covers your ability to read an animal's mood, handle a trained mount, or train an animal to perform tricks.",
      typicalUses: [
        "Calming a frightened or aggressive animal",
        "Training an animal to perform tasks or tricks",
        "Riding a mount in difficult conditions",
        "Reading an animal's emotional state",
        "Commanding animals with supernatural abilities"
      ],
      relatedFeats: ["Mounted Combatant", "Lucky", "Observant"],
      icon: <Heart className="w-6 h-6" />
    },
    "Arcana": {
      ability: "INT",
      description: "Arcana measures your knowledge of magic, arcane symbols, magical traditions, and the planes of existence. It covers your ability to recall lore about spells, magic items, and magical phenomena.",
      typicalUses: [
        "Identifying spells and magical effects",
        "Recognizing magical symbols and runes",
        "Recalling knowledge about magical creatures",
        "Understanding planar phenomena",
        "Crafting or identifying magic items"
      ],
      relatedFeats: ["Spell Sniper", "Lucky", "Elemental Adept"],
      icon: <Zap className="w-6 h-6" />
    },
    "Athletics": {
      ability: "STR",
      description: "Athletics covers difficult situations you encounter while climbing, jumping, or swimming. It represents your physical fitness and ability to perform strenuous physical tasks.",
      typicalUses: [
        "Climbing steep or slippery surfaces",
        "Jumping across gaps or over obstacles",
        "Swimming against strong currents",
        "Breaking down doors or barriers",
        "Grappling or shoving creatures"
      ],
      relatedFeats: ["Athlete", "Grappler", "Lucky", "Mobile"],
      icon: <Mountain className="w-6 h-6" />
    },
    "Deception": {
      ability: "CHA",
      description: "Deception determines whether you can convincingly hide the truth. This deception can encompass everything from misleading others through ambiguity to telling outright lies.",
      typicalUses: [
        "Convincing someone of a lie",
        "Creating a false identity",
        "Impersonating someone else",
        "Hiding your true intentions",
        "Bluffing during social encounters"
      ],
      relatedFeats: ["Actor", "Lucky", "Prodigy"],
      icon: <MessageCircle className="w-6 h-6" />
    },
    "History": {
      ability: "INT",
      description: "History measures your ability to recall lore about historical events, legendary people, ancient kingdoms, past disputes, and lost civilizations.",
      typicalUses: [
        "Recalling historical facts and events",
        "Identifying ancient artifacts",
        "Understanding historical context",
        "Recognizing heraldic symbols",
        "Knowing about famous historical figures"
      ],
      relatedFeats: ["Lucky", "Prodigy", "War Caster"],
      icon: <BookOpen className="w-6 h-6" />
    },
    "Insight": {
      ability: "WIS",
      description: "Insight determines whether you can determine the true intentions of a creature. It involves reading body language, tone of voice, and other subtle cues.",
      typicalUses: [
        "Determining if someone is lying",
        "Reading emotional states and motivations",
        "Sensing deception or hidden intentions",
        "Understanding social dynamics",
        "Detecting illusions or disguises"
      ],
      relatedFeats: ["Observant", "Lucky", "Prodigy"],
      icon: <Eye className="w-6 h-6" />
    },
    "Intimidation": {
      ability: "CHA",
      description: "Intimidation measures your ability to influence others through overt threats, hostile actions, and physical violence. It includes verbal threats and displays of prowess.",
      typicalUses: [
        "Coercing information from captives",
        "Demoralizing enemies in combat",
        "Asserting dominance in social situations",
        "Scaring away creatures or people",
        "Enforcing your will through threats"
      ],
      relatedFeats: ["Battle Master", "Lucky", "Prodigy"],
      icon: <Shield className="w-6 h-6" />
    },
    "Investigation": {
      ability: "INT",
      description: "Investigation allows you to find clues and make deductions. It covers searching for hidden objects, piecing together evidence, and solving puzzles.",
      typicalUses: [
        "Searching for hidden objects or compartments",
        "Analyzing clues and evidence",
        "Solving riddles and puzzles",
        "Detecting traps and secret doors",
        "Researching information"
      ],
      relatedFeats: ["Investigator", "Lucky", "Observant"],
      icon: <Target className="w-6 h-6" />
    },
    "Medicine": {
      ability: "WIS",
      description: "Medicine measures your ability to treat injuries and ailments. It covers your knowledge of anatomy, diagnosis, and treatment of wounds and diseases.",
      typicalUses: [
        "Stabilizing dying creatures",
        "Diagnosing illnesses and injuries",
        "Treating wounds and diseases",
        "Recognizing poison effects",
        "Performing medical procedures"
      ],
      relatedFeats: ["Healer", "Lucky", "Resilient"],
      icon: <Heart className="w-6 h-6" />
    },
    "Nature": {
      ability: "INT",
      description: "Nature measures your ability to recall lore about terrain, plants and animals, the weather, and natural cycles. It covers your knowledge of the natural world.",
      typicalUses: [
        "Identifying plants and animals",
        "Navigating natural terrain",
        "Predicting weather patterns",
        "Finding sources of food and water",
        "Understanding natural phenomena"
      ],
      relatedFeats: ["Lucky", "Observant", "Prodigy"],
      icon: <Mountain className="w-6 h-6" />
    },
    "Perception": {
      ability: "WIS",
      description: "Perception measures your awareness of your surroundings. It covers your ability to notice details, hear sounds, and detect hidden threats.",
      typicalUses: [
        "Noticing hidden creatures or objects",
        "Hearing faint sounds or conversations",
        "Spotting traps and ambushes",
        "Searching for clues in an area",
        "Detecting illusions or disguises"
      ],
      relatedFeats: ["Alert", "Lucky", "Observant"],
      icon: <Eye className="w-6 h-6" />
    },
    "Performance": {
      ability: "CHA",
      description: "Performance determines how well you can delight an audience with music, dance, acting, storytelling, or some other form of entertainment.",
      typicalUses: [
        "Entertaining crowds for coin",
        "Impressing nobles or officials",
        "Distracting enemies in combat",
        "Conveying messages through performance",
        "Inspiring allies with your art"
      ],
      relatedFeats: ["Actor", "Entertainer", "Lucky"],
      icon: <Music className="w-6 h-6" />
    },
    "Persuasion": {
      ability: "CHA",
      description: "Persuasion measures your ability to convince others to do what you want through reasoned argument, flattery, or friendly negotiation.",
      typicalUses: [
        "Convincing someone to help you",
        "Negotiating prices and deals",
        "Inspiring people to action",
        "Mediating disputes",
        "Gaining favors or information"
      ],
      relatedFeats: ["Actor", "Inspiring Leader", "Lucky"],
      icon: <Users className="w-6 h-6" />
    },
    "Religion": {
      ability: "INT",
      description: "Religion measures your ability to recall lore about deities, rites and prayers, religious hierarchies, holy symbols, and the practices of secret cults.",
      typicalUses: [
        "Identifying religious symbols and rituals",
        "Recalling information about deities",
        "Recognizing undead and their vulnerabilities",
        "Understanding religious hierarchies",
        "Identifying holy or unholy effects"
      ],
      relatedFeats: ["War Caster", "Lucky", "Prodigy"],
      icon: <Star className="w-6 h-6" />
    },
    "Sleight of Hand": {
      ability: "DEX",
      description: "Sleight of Hand covers attempts to perform tricks and manual feats of legerdemain, such as picking pockets or planting something on someone else.",
      typicalUses: [
        "Picking pockets or stealing objects",
        "Performing magic tricks or illusions",
        "Palming small objects",
        "Escaping from manacles",
        "Planting items on others"
      ],
      relatedFeats: ["Lucky", "Skulker", "Prodigy"],
      icon: <Wrench className="w-6 h-6" />
    },
    "Stealth": {
      ability: "DEX",
      description: "Stealth measures your ability to conceal yourself from enemies, slink past guards, slip away without being noticed, or sneak up on someone without being seen or heard.",
      typicalUses: [
        "Hiding from enemies",
        "Moving silently through an area",
        "Sneaking up on creatures",
        "Avoiding detection while following someone",
        "Concealing yourself in shadows"
      ],
      relatedFeats: ["Alert", "Lucky", "Skulker"],
      icon: <Eye className="w-6 h-6" />
    },
    "Survival": {
      ability: "WIS",
      description: "Survival measures your ability to track, hunt, and navigate in the wilderness. It covers your knowledge of terrain, weather, and natural hazards.",
      typicalUses: [
        "Tracking creatures through wilderness",
        "Finding food and water in the wild",
        "Navigating difficult terrain",
        "Predicting weather patterns",
        "Avoiding natural hazards"
      ],
      relatedFeats: ["Lucky", "Observant", "Prodigy"],
      icon: <Mountain className="w-6 h-6" />
    }
  };

  const currentSkillData = skillData[skill] || {
    ability: "Unknown",
    description: `${skill} is a skill that measures your ability to perform certain tasks.`,
    typicalUses: ["Various applications depending on the skill"],
    relatedFeats: ["Various feats"],
    icon: <Star className="w-6 h-6" />
  };

  return (
    <div className="fixed inset-0 backdrop-blur-md flex items-center justify-center z-50 p-4">
      <div className="bg-theme-secondary border border-theme-primary rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-theme-primary">
          <div className="flex items-center gap-3">
            <div className="text-accent-blue-light">
              {currentSkillData.icon}
            </div>
            <div>
              <h2 className="text-xl font-bold text-theme-primary">{skill}</h2>
              <p className="text-sm text-theme-muted">{currentSkillData.ability} Skill</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-theme-tertiary rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Description */}
          <div className="bg-theme-tertiary/50 p-4 rounded-lg">
            <h3 className="text-sm font-semibold text-theme-muted uppercase mb-2">Description</h3>
            <p className="text-sm text-theme-primary leading-relaxed">{currentSkillData.description}</p>
          </div>

          {/* Typical Uses */}
          <div className="bg-theme-tertiary/50 p-4 rounded-lg">
            <h3 className="text-sm font-semibold text-theme-muted uppercase mb-2">Typical Uses</h3>
            <ul className="text-sm text-theme-primary space-y-1">
              {currentSkillData.typicalUses.map((use, index) => (
                <li key={index} className="flex items-start">
                  <span className="text-accent-yellow-light mr-2">•</span>
                  <span>{use}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Related Feats */}
          <div className="bg-theme-tertiary/50 p-4 rounded-lg">
            <h3 className="text-sm font-semibold text-theme-muted uppercase mb-2">Related Feats</h3>
            <div className="flex flex-wrap gap-2">
              {currentSkillData.relatedFeats.map((feat, index) => (
                <span key={index} className="px-3 py-1 bg-accent-purple text-white text-xs rounded-full">
                  {feat}
                </span>
              ))}
            </div>
          </div>

          {/* Ability Modifier Note */}
          <div className="bg-theme-tertiary/30 p-3 rounded-lg">
            <p className="text-xs text-theme-muted">
              <strong>Ability:</strong> {currentSkillData.ability} •
              <strong> Modifier:</strong> Your proficiency bonus is added to checks when you have proficiency in this skill.
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end p-6 border-t border-theme-primary">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-theme-quaternary hover:bg-theme-hover rounded-lg text-white transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};