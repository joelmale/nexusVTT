import type { CharacterCreationData, SkillName } from '../types/dnd';
import { ALL_SKILLS, FEAT_DATABASE } from '../services/dataService';
import { choiceId, humanOriginFeat } from '../services/originChoices';
import styles from './CastingGrantChoices.module.css';

export function OriginGrantChoices({
  data,
  onChange,
}: {
  data: CharacterCreationData;
  onChange: (update: Partial<CharacterCreationData>) => void;
}) {
  if (
    data.edition !== '2024' ||
    !['human-2024', 'elf-2024'].includes(data.speciesSlug)
  )
    return null;
  const human = data.speciesSlug === 'human-2024';
  const skills = human ? ALL_SKILLS : ['Insight', 'Perception', 'Survival'];
  return (
    <section className={styles.grants} aria-label="Species choices">
      <h3>Species choices</h3>
      {!human && (
        <label>
          Elven lineage{' '}
          <select
            value={choiceId(data.selectedLineage ?? '')}
            onChange={(event) =>
              onChange({ selectedLineage: event.target.value })
            }
          >
            <option value="">Choose a lineage</option>
            {['high-elf', 'wood-elf', 'drow'].map((lineage) => (
              <option key={lineage}>{lineage}</option>
            ))}
          </select>
        </label>
      )}
      <label>
        Species skill{' '}
        <select
          value={data.speciesSkillProficiency ?? ''}
          onChange={(event) =>
            onChange({
              speciesSkillProficiency: event.target.value as SkillName,
            })
          }
        >
          <option value="">Choose a skill</option>
          {skills.map((skill) => (
            <option key={skill}>{skill}</option>
          ))}
        </select>
      </label>
      {human && (
        <label>
          Human Origin feat{' '}
          <select
            value={humanOriginFeat(data) ?? ''}
            onChange={(event) =>
              onChange({
                humanOriginFeat: event.target.value,
                humanVersatileFeat: undefined,
                speciesFeat: undefined,
              })
            }
          >
            <option value="">Choose an Origin feat</option>
            {FEAT_DATABASE.filter((feat) => feat.category === 'origin').map(
              (feat) => (
                <option value={feat.slug} key={feat.slug}>
                  {feat.name}
                </option>
              ),
            )}
          </select>
        </label>
      )}
    </section>
  );
}
