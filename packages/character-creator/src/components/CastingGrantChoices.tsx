import type { CharacterCastingSource } from '@nexus/character-contracts';
import type { CharacterCreationData } from '../types/dnd';
import { loadSpells } from '../services/dataService';
import { resolveCastingGrants } from '../services/castingSources';
import styles from './CastingGrantChoices.module.css';
import { OriginGrantChoices } from './OriginGrantChoices';
import { ClassGrantChoices } from './ClassGrantChoices';
import { FeatProficiencyChoices } from './FeatProficiencyChoices';
import { humanizeId } from '../utils/displayLabels';

export function CastingGrantChoices({
  data,
  onChange,
  classFreeOnly = false,
  omitClassChoices = false,
}: {
  data: CharacterCreationData;
  onChange: (update: Partial<CharacterCreationData>) => void;
  classFreeOnly?: boolean;
  /** The Class step already shows the class choices; do not repeat them. */
  omitClassChoices?: boolean;
}) {
  const grants = resolveCastingGrants(data).filter(
    (grant) => !classFreeOnly || grant.source.resourceId,
  );
  if (!grants.length)
    return (
      <>
        {!classFreeOnly && (
          <>
            <OriginGrantChoices data={data} onChange={onChange} />
            {!omitClassChoices && (
              <ClassGrantChoices data={data} onChange={onChange} />
            )}
            <FeatProficiencyChoices data={data} onChange={onChange} />
          </>
        )}
      </>
    );
  const catalog = loadSpells(data.edition);
  const update = (id: string, patch: Partial<CharacterCastingSource>) =>
    onChange({
      additionalCastingSources: grants.map(({ source }) =>
        source.id === id ? { ...source, ...patch } : source,
      ),
    });
  return (
    <section className={styles.grants} aria-label="Granted spell choices">
      {!classFreeOnly && (
        <>
          <OriginGrantChoices data={data} onChange={onChange} />
          {!omitClassChoices && (
              <ClassGrantChoices data={data} onChange={onChange} />
            )}
          <FeatProficiencyChoices data={data} onChange={onChange} />
        </>
      )}
      <h3>
        {classFreeOnly
          ? 'Class free-casting spells'
          : 'Spells from your class, species and feats'}
      </h3>
      {grants.map(
        ({
          source,
          spellClass,
          cantripChoices,
          spellChoices,
          ritualChoices,
          chooseSpellClass,
          spellLevel = 1,
          eligibleSpellSlugs,
        }) => (
          <fieldset className={styles.grant} key={source.id}>
            <legend>{humanizeId(source.sourceSlug)}</legend>
            {chooseSpellClass && (
              <label className={styles.field}>
                Magic Initiate spell list{' '}
                <select
                  className={styles.select}
                  value={spellClass}
                  onChange={(event) =>
                    onChange({
                      featChoices: {
                        ...data.featChoices,
                        'magic-initiate': {
                          ...data.featChoices?.['magic-initiate'],
                          spellList: event.target.value,
                        },
                      },
                      additionalCastingSources: (
                        data.additionalCastingSources ?? []
                      ).filter((entry) => entry.id !== source.id),
                    })
                  }
                >
                  {['cleric', 'druid', 'wizard'].map((name) => (
                    <option key={name} value={name}>
                      {humanizeId(name)}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {source.sourceType === 'class' ? (
              <p>Spellcasting ability: {source.ability}</p>
            ) : (
              <label className={styles.field}>
                Casting ability{' '}
                <select
                  className={styles.select}
                  aria-label={`Casting ability for ${source.sourceSlug}`}
                  value={source.ability}
                  onChange={(event) =>
                    update(source.id, {
                      ability: event.target
                        .value as CharacterCastingSource['ability'],
                    })
                  }
                >
                  {['INT', 'WIS', 'CHA'].map((ability) => (
                    <option key={ability}>{ability}</option>
                  ))}
                </select>
              </label>
            )}
            {cantripChoices > 0 ? (
              <>
                <p>
                  Choose {cantripChoices} cantrip
                  {cantripChoices === 1 ? '' : 's'}.
                </p>
                <div className={styles.options}>
                  {catalog
                    .filter(
                      (spell) =>
                        spell.level === 0 &&
                        (!spellClass || spell.classes.includes(spellClass)),
                    )
                    .map((spell) => (
                      <label className={styles.option} key={spell.slug}>
                        <input
                          type="checkbox"
                          checked={source.cantrips.includes(spell.slug)}
                          disabled={
                            !source.cantrips.includes(spell.slug) &&
                            source.cantrips.length >= cantripChoices
                          }
                          onChange={() =>
                            update(source.id, {
                              cantrips: source.cantrips.includes(spell.slug)
                                ? source.cantrips.filter(
                                    (slug) => slug !== spell.slug,
                                  )
                                : [...source.cantrips, spell.slug],
                            })
                          }
                        />
                        <span>{spell.name}</span>
                      </label>
                    ))}
                </div>
              </>
            ) : (
              <p>Cantrips: {source.cantrips.map(humanizeId).join(', ')}</p>
            )}
            {spellChoices > 1 && (
              <fieldset className={styles.group}>
                <legend>Choose {spellChoices} level 1 rituals</legend>
                <div className={styles.options}>
                {catalog
                  .filter(
                    (spell) =>
                      spell.level === 1 && (!ritualChoices || spell.ritual),
                  )
                  .map((spell) => (
                    <label className={styles.option} key={spell.slug}>
                      <input
                        type="checkbox"
                        checked={source.preparedSpells.includes(spell.slug)}
                        onChange={() =>
                          update(source.id, {
                            preparedSpells: source.preparedSpells.includes(
                              spell.slug,
                            )
                              ? source.preparedSpells.filter(
                                  (slug) => slug !== spell.slug,
                                )
                              : [...source.preparedSpells, spell.slug],
                          })
                        }
                      />
                      <span>{spell.name}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            )}
            {spellChoices === 1 && (
              <label className={styles.field}>
                Level {spellLevel} spell{' '}
                <select
                  className={styles.select}
                  aria-label={`Level ${spellLevel} spell for ${source.sourceSlug}`}
                  value={source.preparedSpells[0] ?? ''}
                  onChange={(event) =>
                    update(source.id, { preparedSpells: [event.target.value] })
                  }
                >
                  <option value="">Choose a spell</option>
                  {catalog
                    .filter(
                      (spell) =>
                        spell.level === spellLevel &&
                        (!eligibleSpellSlugs ||
                          eligibleSpellSlugs.includes(spell.slug)) &&
                        (!spellClass || spell.classes.includes(spellClass)),
                    )
                    .map((spell) => (
                      <option value={spell.slug} key={spell.slug}>
                        {spell.name}
                      </option>
                    ))}
                </select>
              </label>
            )}
            <p>
              {source.atWill
                ? source.ritualOnly
                  ? 'These leveled spells are rituals: add 10 minutes and spend no spell slot.'
                  : 'This source casts its spells at will, without spell slots.'
                : source.resourceId
                  ? 'Free castings share this class feature’s remaining uses and recovery rule.'
                  : source.freeUses
                    ? 'Granted leveled spells have one free use each per long rest and can also use your class spell slots.'
                    : 'These class spells stay prepared and use your class spell slots.'}
            </p>
          </fieldset>
        ),
      )}
    </section>
  );
}
