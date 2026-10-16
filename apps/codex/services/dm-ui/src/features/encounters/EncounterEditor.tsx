import { useMemo, useState } from 'react';

import type { TrapComplexity, TrapDetails } from '@/demo/fixture-registry';
import { useEditableCommit } from '@/features/section-shell/EditableCommitContext';
import { useSectionBundle } from '@/features/section-shell/SectionContext';
import { humanize } from '@/features/section-shell/statusTones';

import { compositionOf, useDraftRating } from './encounterDraft';
import styles from './EncounterEditor.module.css';
import {
  ENCOUNTER_KIND_LABELS,
  RULESET_LABELS,
} from './encountersModels';
import {
  buildMonsterCatalog,
  componentFromMonster,
  editionOfBundle,
  filterMonsters,
  homebrewKey,
  rateComposition,
  type CatalogMonster,
  type EncounterComponent,
  type MonsterSort,
  type MonsterSource,
} from './monsterCatalog';

type Draft = Record<string, unknown>;

const RESULT_LIMIT = 8;
const KINDS = Object.keys(ENCOUNTER_KIND_LABELS);
const SIZES = ['Tiny', 'Small', 'Medium', 'Large', 'Huge', 'Gargantuan'];
const TYPES = [
  'aberration',
  'beast',
  'celestial',
  'construct',
  'dragon',
  'elemental',
  'fey',
  'fiend',
  'giant',
  'humanoid',
  'monstrosity',
  'ooze',
  'plant',
  'undead',
];

export function EncounterEditor({
  draft,
  setDraft,
}: {
  draft: Draft;
  setDraft: (next: Draft) => void;
}) {
  const { bundle } = useSectionBundle();
  const commit = useEditableCommit();
  const { catalog, rating, party, edition } = useDraftRating(bundle, draft);
  const composition = compositionOf(draft);

  const setComposition = (next: EncounterComponent[]) =>
    setDraft({ ...draft, composition: next });
  const updateRow = (index: number, patch: Partial<EncounterComponent>) =>
    setComposition(
      composition.map((row, at) => (at === index ? { ...row, ...patch } : row)),
    );

  const isTrap = draft.kind === 'trap';
  const trapDetails = draft.trapDetails as TrapDetails | undefined;

  const updateTrapField = <K extends keyof TrapDetails>(
    field: K,
    value: TrapDetails[K] | undefined,
  ) => {
    const currentTrap = (draft.trapDetails as TrapDetails | undefined) ?? {
      complexity: 'simple' as const,
    };
    const nextTrap: TrapDetails = {
      ...currentTrap,
      [field]: value,
    };
    if (value === undefined || value === '') {
      delete nextTrap[field];
    }
    setDraft({ ...draft, trapDetails: nextTrap });
  };

  return (
    <>
      <label>
        Title
        <input
          onChange={(event) => setDraft({ ...draft, title: event.target.value })}
          value={String(draft.title ?? '')}
        />
      </label>
      <label>
        Kind
        <select
          onChange={(event) => {
            const nextKind = event.target.value;
            setDraft({
              ...draft,
              kind: nextKind,
              ...(nextKind === 'trap' && !draft.trapDetails
                ? { trapDetails: { complexity: 'simple' } }
                : {}),
            });
          }}
          value={String(draft.kind ?? 'combat')}
        >
          {KINDS.map((kind) => (
            <option key={kind} value={kind}>
              {ENCOUNTER_KIND_LABELS[kind as keyof typeof ENCOUNTER_KIND_LABELS]}
            </option>
          ))}
        </select>
      </label>
      <label>
        Trigger
        <textarea
          onChange={(event) =>
            setDraft({ ...draft, trigger: event.target.value })
          }
          rows={2}
          value={String(draft.trigger ?? '')}
        />
      </label>
      <label>
        Intended use
        <textarea
          onChange={(event) =>
            setDraft({ ...draft, intendedUse: event.target.value })
          }
          rows={2}
          value={String(draft.intendedUse ?? '')}
        />
      </label>

      {isTrap || draft.trapDetails ? (
        <fieldset className={styles.trapFieldset}>
          <legend>Trap & Puzzle Specification</legend>
          <div className={styles.gridTwo}>
            <label>
              Complexity & Type
              <select
                aria-label="Trap Complexity"
                onChange={(event) =>
                  updateTrapField(
                    'complexity',
                    event.target.value as TrapComplexity,
                  )
                }
                value={String(trapDetails?.complexity ?? 'simple')}
              >
                <option value="simple">Simple Trap (One-Shot Trigger)</option>
                <option value="complex">
                  Complex Trap (Dynamic Initiative / Multi-Round)
                </option>
                <option value="puzzle">
                  Puzzle Trap (Riddle / Mechanical Mechanism)
                </option>
              </select>
            </label>
            <label>
              Trigger Condition
              <input
                aria-label="Trap Trigger"
                onChange={(event) => updateTrapField('trigger', event.target.value)}
                placeholder="e.g. Stepping on center stone, opening door"
                value={String(trapDetails?.trigger ?? '')}
              />
            </label>
          </div>

          <div className={styles.gridTwo}>
            <label>
              Detection DC (Perception / Investigation)
              <input
                aria-label="Detection DC"
                onChange={(event) =>
                  updateTrapField(
                    'detectionDc',
                    event.target.value ? Number(event.target.value) : undefined,
                  )
                }
                placeholder="e.g. 15"
                type="number"
                value={trapDetails?.detectionDc ?? ''}
              />
            </label>
            <label>
              Disarm / Disable DC (Thieves' Tools / Arcana)
              <input
                aria-label="Disarm DC"
                onChange={(event) =>
                  updateTrapField(
                    'disarmDc',
                    event.target.value ? Number(event.target.value) : undefined,
                  )
                }
                placeholder="e.g. 15"
                type="number"
                value={trapDetails?.disarmDc ?? ''}
              />
            </label>
          </div>

          <div className={styles.gridTwo}>
            <label>
              Attack / Saving Throw
              <input
                aria-label="Trap Attack or Save"
                onChange={(event) =>
                  updateTrapField('saveOrAttack', event.target.value)
                }
                placeholder="e.g. DC 15 Dex save or +8 spell attack"
                value={String(trapDetails?.saveOrAttack ?? '')}
              />
            </label>
            <label>
              Initiative / Round Timer
              <input
                aria-label="Trap Initiative or Timer"
                onChange={(event) =>
                  updateTrapField('initiativeOrTimer', event.target.value)
                }
                placeholder="e.g. Initiative 20 & 10; 4 rounds until crush"
                value={String(trapDetails?.initiativeOrTimer ?? '')}
              />
            </label>
          </div>

          <label>
            Damage & Harm Effect
            <textarea
              aria-label="Trap Effect"
              onChange={(event) => updateTrapField('effect', event.target.value)}
              placeholder="e.g. 4d10 piercing damage and pinned; room lowers 3ft/round"
              rows={2}
              value={String(trapDetails?.effect ?? '')}
            />
          </label>

          <label>
            Countermeasures, Disarm Steps & Puzzle Solution
            <textarea
              aria-label="Trap Countermeasures"
              onChange={(event) =>
                updateTrapField('countermeasures', event.target.value)
              }
              placeholder="e.g. Jam lowering gears with DC 15 Athletics using iron spikes. To unlock the exit, press runes in order: Sun, Moon, Star."
              rows={3}
              value={String(trapDetails?.countermeasures ?? '')}
            />
          </label>

          <label>
            Reset Mechanism
            <input
              aria-label="Trap Reset"
              onChange={(event) => updateTrapField('reset', event.target.value)}
              placeholder="e.g. Automatic after 10 minutes, Manual winch in control room, None"
              value={String(trapDetails?.reset ?? '')}
            />
          </label>
        </fieldset>
      ) : null}

      <fieldset className={styles.fieldset}>
        <legend>Composition</legend>
        {composition.length === 0 ? (
          <p className={styles.muted}>No monsters yet. Add one below.</p>
        ) : (
          <ul aria-label="Encounter composition" className={styles.rows}>
            {composition.map((row, index) => (
              <li className={styles.compRow} key={`${row.name}-${index}`}>
                <span className={styles.compName}>
                  {row.name}
                  <span className={styles.compMeta}>
                    {row.cr ? `CR ${row.cr} · ` : ''}
                    {row.nonCreature
                      ? 'Hazard, not a creature'
                      : row.monsterKey?.startsWith('homebrew:')
                        ? 'Homebrew'
                        : (RULESET_LABELS[row.ruleset] ?? row.ruleset)}
                  </span>
                </span>
                <label className={styles.inline}>
                  <span className={styles.srOnly}>Count for {row.name}</span>
                  <input
                    aria-label={`Count for ${row.name}`}
                    min={1}
                    onBlur={() =>
                      row.count < 1 && updateRow(index, { count: 1 })
                    }
                    onChange={(event) =>
                      updateRow(index, {
                        count: Math.max(
                          0,
                          Math.floor(Number(event.target.value) || 0),
                        ),
                      })
                    }
                    type="number"
                    value={row.count}
                  />
                </label>
                <label className={styles.inline}>
                  <span className={styles.srOnly}>Role for {row.name}</span>
                  <input
                    aria-label={`Role for ${row.name}`}
                    onChange={(event) =>
                      updateRow(index, { role: event.target.value })
                    }
                    placeholder="Role"
                    value={row.role}
                  />
                </label>
                <button
                  aria-label={`Remove ${row.name}`}
                  onClick={() => {
                    setComposition(composition.filter((_, at) => at !== index));
                    commit();
                  }}
                  type="button"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
        <DifficultyHint
          edition={edition}
          party={party.length}
          rating={rating}
        />
        <MonsterPicker
          catalog={catalog}
          onAdd={(monster) => {
            setComposition([...composition, componentFromMonster(monster)]);
            commit();
          }}
        />
      </fieldset>

      <label>
        Tactics (DM only)
        <textarea
          onChange={(event) =>
            setDraft({ ...draft, tactics: event.target.value })
          }
          rows={3}
          value={String(draft.tactics ?? '')}
        />
      </label>
      <label>
        Ruleset notes
        <textarea
          onChange={(event) =>
            setDraft({ ...draft, rulesetNotes: event.target.value })
          }
          rows={2}
          value={String(draft.rulesetNotes ?? '')}
        />
      </label>
    </>
  );
}

export function DifficultyHint({
  rating,
  party,
  edition,
}: {
  rating: ReturnType<typeof rateComposition>;
  party: number;
  edition: string;
}) {
  const { result, unrated } = rating;
  return (
    <p className={styles.hint} role="status">
      {party === 0
        ? 'Add party members to calculate difficulty.'
        : result
          ? `Calculated difficulty: ${humanize(result.rating)} (${result.xp} XP vs. ${party} characters, ${edition} rules).`
          : 'Add monsters to calculate difficulty.'}
      {unrated.length > 0
        ? ` Not rated, no challenge rating: ${unrated.join(', ')}.`
        : ''}
    </p>
  );
}

function MonsterPicker({
  catalog,
  onAdd,
}: {
  catalog: CatalogMonster[];
  onAdd: (monster: CatalogMonster) => void;
}) {
  const [query, setQuery] = useState('');
  const [source, setSource] = useState<MonsterSource | 'all'>('all');
  const [sort, setSort] = useState<MonsterSort>('name');
  const [creating, setCreating] = useState(false);
  const results = useMemo(
    () => filterMonsters(catalog, { query, source, sort }),
    [catalog, query, source, sort],
  );

  return (
    <div className={styles.picker}>
      <div className={styles.pickerControls}>
        <label>
          Find a monster
          <input
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Name or type"
            type="search"
            value={query}
          />
        </label>
        <label>
          Source
          <select
            onChange={(event) =>
              setSource(event.target.value as MonsterSource | 'all')
            }
            value={source}
          >
            <option value="all">All sources</option>
            <option value="canonical">Canonical (SRD)</option>
            <option value="homebrew">Homebrew</option>
          </select>
        </label>
        <label>
          Sort
          <select
            onChange={(event) => setSort(event.target.value as MonsterSort)}
            value={sort}
          >
            <option value="name">Name</option>
            <option value="cr">Challenge rating</option>
            <option value="source">Source</option>
          </select>
        </label>
      </div>
      <ul aria-label="Monster results" className={styles.results}>
        {results.slice(0, RESULT_LIMIT).map((monster) => (
          <li className={styles.result} key={monster.key}>
            <span>
              {monster.name}
              <span className={styles.compMeta}>
                CR {monster.cr} · {monster.size} {monster.type}
              </span>
            </span>
            <span
              className={
                monster.source === 'homebrew' ? styles.homebrew : styles.canon
              }
            >
              {monster.source === 'homebrew' ? 'Homebrew' : 'SRD'}
            </span>
            <button
              aria-label={`Add ${monster.name}`}
              onClick={() => onAdd(monster)}
              type="button"
            >
              Add
            </button>
          </li>
        ))}
      </ul>
      {results.length === 0 ? (
        <p className={styles.muted}>No monsters match.</p>
      ) : results.length > RESULT_LIMIT ? (
        <p className={styles.muted}>
          Showing {RESULT_LIMIT} of {results.length}. Refine the search.
        </p>
      ) : null}
      {creating ? (
        <HomebrewForm
          onCancel={() => setCreating(false)}
          onCreated={(monster) => {
            onAdd(monster);
            setCreating(false);
          }}
        />
      ) : (
        <button onClick={() => setCreating(true)} type="button">
          Create homebrew monster
        </button>
      )}
    </div>
  );
}

const ABILITY_LABELS = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'];

/** Not a <form>: it lives inside the encounter edit form. */
function HomebrewForm({
  onCancel,
  onCreated,
}: {
  onCancel: () => void;
  onCreated: (monster: CatalogMonster) => void;
}) {
  const { store, bundle } = useSectionBundle();
  const edition = editionOfBundle(bundle);
  const [fields, setFields] = useState({
    name: '',
    cr: '1',
    size: 'Medium',
    type: 'humanoid',
    ac: '12',
    hp: '20',
    speed: '30',
    notes: '',
  });
  const [abilities, setAbilities] = useState<string[]>(
    ABILITY_LABELS.map(() => '10'),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const set = (key: keyof typeof fields, value: string) =>
    setFields({ ...fields, [key]: value });

  const create = async () => {
    if (!fields.name.trim()) {
      setError('Give the monster a name.');
      return;
    }
    setBusy(true);
    setError(undefined);
    const draft = {
      name: fields.name.trim(),
      cr: fields.cr.trim() || '1',
      size: fields.size,
      type: fields.type,
      ac: Number(fields.ac) || 10,
      hp: Number(fields.hp) || 1,
      speed: Number(fields.speed) || 0,
      abilities: abilities.map((score) => Number(score) || 10),
      edition,
      notes: fields.notes,
    };
    const result = await store.addItem('homebrew-monster', draft);
    setBusy(false);
    if (!result.ok || !result.id) {
      setError(result.error ?? 'Could not save the monster.');
      return;
    }
    const [created] = buildMonsterCatalog([
      {
        id: result.id,
        campaignId: bundle.campaignId,
        ...draft,
        abilities: draft.abilities as CatalogMonster['abilities'],
      },
    ]).filter((monster) => monster.key === homebrewKey(result.id!));
    if (created) onCreated(created);
  };

  return (
    <div aria-label="New homebrew monster" className={styles.homebrewForm} role="group">
      <label>
        Monster name
        <input
          onChange={(event) => set('name', event.target.value)}
          value={fields.name}
        />
      </label>
      <label>
        CR
        <input
          onChange={(event) => set('cr', event.target.value)}
          value={fields.cr}
        />
      </label>
      <label>
        Size
        <select onChange={(event) => set('size', event.target.value)} value={fields.size}>
          {SIZES.map((size) => (
            <option key={size}>{size}</option>
          ))}
        </select>
      </label>
      <label>
        Type
        <select onChange={(event) => set('type', event.target.value)} value={fields.type}>
          {TYPES.map((type) => (
            <option key={type}>{type}</option>
          ))}
        </select>
      </label>
      <label>
        AC
        <input
          min={0}
          onChange={(event) => set('ac', event.target.value)}
          type="number"
          value={fields.ac}
        />
      </label>
      <label>
        HP
        <input
          min={1}
          onChange={(event) => set('hp', event.target.value)}
          type="number"
          value={fields.hp}
        />
      </label>
      <label>
        Speed (ft)
        <input
          min={0}
          onChange={(event) => set('speed', event.target.value)}
          type="number"
          value={fields.speed}
        />
      </label>
      <div className={styles.abilities}>
        {ABILITY_LABELS.map((label, index) => (
          <label key={label}>
            {label}
            <input
              aria-label={`${label} score`}
              max={30}
              min={1}
              onChange={(event) =>
                setAbilities(
                  abilities.map((score, at) =>
                    at === index ? event.target.value : score,
                  ),
                )
              }
              type="number"
              value={abilities[index]}
            />
          </label>
        ))}
      </div>
      <label className={styles.wide}>
        Traits and actions
        <textarea
          onChange={(event) => set('notes', event.target.value)}
          rows={3}
          value={fields.notes}
        />
      </label>
      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
      <div className={styles.actions}>
        <button disabled={busy} onClick={() => void create()} type="button">
          {busy ? 'Saving…' : 'Save monster and add'}
        </button>
        <button disabled={busy} onClick={onCancel} type="button">
          Cancel
        </button>
      </div>
    </div>
  );
}
