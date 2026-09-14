import React, { useState, useMemo } from 'react';
import { X, Check, Lock } from 'lucide-react';
import { loadClasses, BACKGROUNDS } from '../services/dataService';
import skillsData from '../data/skills.json';

interface SkillEditModalProps {
  classSlug: string;
  backgroundSlug: string;
  currentSkills: string[];
  isOpen: boolean;
  onClose: () => void;
  onSave: (skills: string[]) => void;
}

interface Skill {
  name: string;
  ability: string;
  description: string;
  example: string;
}

const SkillEditModal: React.FC<SkillEditModalProps> = ({
  classSlug,
  backgroundSlug,
  currentSkills,
  isOpen,
  onClose,
  onSave
}) => {
  const classData = useMemo(() => {
    const allClasses = loadClasses();
    return allClasses.find(c => c.slug === classSlug);
  }, [classSlug]);

  const backgroundData = useMemo(() => {
    return BACKGROUNDS.find(bg => bg.name === backgroundSlug);
  }, [backgroundSlug]);

  const availableClassSkills = classData?.skill_proficiencies || [];
  const backgroundSkills = backgroundData?.skill_proficiencies || [];
  const maxSkills = classData?.num_skill_choices || 2;

  // Separate class skills from background skills in current selection
  const initialClassSkills = currentSkills.filter(skill =>
    !backgroundSkills.includes(skill) && availableClassSkills.includes(skill)
  );

  const [selectedClassSkills, setSelectedClassSkills] = useState<string[]>(initialClassSkills);

  const handleSkillToggle = (skill: string) => {
    setSelectedClassSkills(prev => {
      const isSelected = prev.includes(skill);
      if (isSelected) {
        return prev.filter(s => s !== skill);
      } else if (prev.length < maxSkills) {
        return [...prev, skill];
      }
      return prev;
    });
  };

  const handleSave = () => {
    // Combine class skills and background skills
    const allSkills = [...new Set([...selectedClassSkills, ...backgroundSkills])];
    onSave(allSkills);
    onClose();
  };

  const getSkillInfo = (skillName: string) => {
    return (skillsData as Skill[]).find(s => s.name === skillName);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 backdrop-blur-md flex items-center justify-center z-50 p-4">
      <div className="bg-theme-secondary rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-theme-secondary">
          <div>
            <h2 className="text-xl font-bold text-white">Edit Skills</h2>
            <p className="text-sm text-theme-muted">
              Choose {maxSkills} skill{maxSkills !== 1 ? 's' : ''} from your class proficiencies
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-theme-tertiary rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-theme-muted" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
          {/* Selection Summary */}
          <div className="bg-accent-purple-darker/20 border border-accent-purple-dark rounded-lg p-4 mb-6">
            <h3 className="text-lg font-bold text-accent-purple-light mb-2">
              Class Skills Selected ({selectedClassSkills.length}/{maxSkills})
            </h3>
            <p className="text-sm text-theme-muted">
              Select {maxSkills} skill proficienc{maxSkills !== 1 ? 'ies' : 'y'} from your {classData?.name} class options
            </p>
          </div>

          {/* Background Skills (Locked) */}
          {backgroundSkills.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-accent-green-light mb-3 flex items-center gap-2">
                Background Skills (Locked)
                <Lock className="w-4 h-4" />
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {backgroundSkills.map(skill => {
                  const skillInfo = getSkillInfo(skill);
                  return (
                    <div
                      key={skill}
                      className="p-4 rounded-lg border-2 bg-accent-green-darker/30 border-accent-green"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h4 className="font-semibold text-white">{skill}</h4>
                          <p className="text-xs text-theme-muted">{skillInfo?.ability || 'Unknown'}</p>
                        </div>
                        <Lock className="w-5 h-5 text-accent-green-light flex-shrink-0" />
                      </div>
                      {skillInfo && (
                        <p className="text-xs text-theme-muted mt-2">{skillInfo.description}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Class Skills (Selectable) */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-accent-purple-light mb-3">
              Class Skills (Choose {maxSkills})
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {availableClassSkills.map(skill => {
                const isSelected = selectedClassSkills.includes(skill);
                const isBackgroundSkill = backgroundSkills.includes(skill);
                const skillInfo = getSkillInfo(skill);

                return (
                  <button
                    key={skill}
                    onClick={() => !isBackgroundSkill && handleSkillToggle(skill)}
                    disabled={isBackgroundSkill || (!isSelected && selectedClassSkills.length >= maxSkills)}
                    className={`p-4 rounded-lg border-2 transition-all text-left ${
                      isBackgroundSkill
                        ? 'bg-theme-tertiary/50 border-theme-primary opacity-50 cursor-not-allowed'
                        : isSelected
                        ? 'bg-accent-purple-darker border-accent-purple shadow-md'
                        : 'bg-theme-tertiary border-theme-primary hover:bg-theme-quaternary'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h4 className="font-semibold text-white flex items-center gap-2">
                          {skill}
                          {isBackgroundSkill && <span className="text-xs text-accent-green-light">(from background)</span>}
                        </h4>
                        <p className="text-xs text-theme-muted">{skillInfo?.ability || 'Unknown'}</p>
                      </div>
                      {isSelected && !isBackgroundSkill && (
                        <Check className="w-5 h-5 text-accent-purple-light flex-shrink-0" />
                      )}
                    </div>
                    {skillInfo && (
                      <p className="text-xs text-theme-muted mt-2">{skillInfo.description}</p>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-theme-secondary bg-theme-primary">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-theme-tertiary hover:bg-theme-quaternary rounded-lg text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={selectedClassSkills.length !== maxSkills}
            className={`px-6 py-2 rounded-lg font-semibold transition-colors flex items-center gap-2 ${
              selectedClassSkills.length === maxSkills
                ? 'bg-accent-purple hover:bg-accent-purple-light text-white'
                : 'bg-theme-quaternary text-theme-muted cursor-not-allowed'
            }`}
          >
            <Check className="w-5 h-5" />
            Save Skills {selectedClassSkills.length !== maxSkills && `(${selectedClassSkills.length}/${maxSkills})`}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SkillEditModal;
