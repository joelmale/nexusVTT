import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ClassResourceControls } from '@nexus/character-creator';
import type { SpellDefinition } from '@nexus/game-contracts';
import type { PanelComponentProps } from '@/services/panelRegistry';
import {
  loadActorSpellbook,
  type SpellbookActor,
} from '@/services/actorSpellbook';
import {
  commandClient,
  type CommandExecutionResult,
} from '@/services/commandClient';
import { useCharacterStore } from '@/stores/characterStore';
import { useGameStore } from '@/stores/gameStore';
import styles from './SpellbookPanel.module.css';

/** One casting surface reused by the desktop sheet and Simple Player Mode. */
export const SpellbookPanel: React.FC<
  PanelComponentProps & { readonly?: boolean }
> = ({ link, readonly = false }) => {
  const character = useCharacterStore((state) =>
    state.characters.find((entry) => entry.id === link.id),
  );
  const user = useGameStore((state) => state.user);
  const campaignId = useGameStore(
    (state) => link.campaignId || state.session?.campaignId,
  );
  const [actor, setActor] = useState<SpellbookActor>();
  const [spells, setSpells] = useState<SpellDefinition[]>([]);
  const [profileId, setProfileId] = useState('');
  const [preparationEdits, setPreparationEdits] = useState<
    Record<string, string[]>
  >({});
  const [levels, setLevels] = useState<Record<string, number>>({});
  const [status, setStatus] = useState<string>();
  const [hitDiceToSpend, setHitDiceToSpend] = useState(0);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const inFlight = useRef(false);
  const refreshGeneration = useRef(0);
  const [retry, setRetry] = useState<{
    operation: () => Promise<CommandExecutionResult>;
  }>();
  const canControl =
    !readonly && (user.type === 'host' || character?.playerId === user.id);

  const refresh = useCallback(async () => {
    if (!campaignId) return;
    const generation = ++refreshGeneration.current;
    try {
      const result = await loadActorSpellbook(
        campaignId,
        link.id,
        user.id,
        canControl,
      );
      if (generation !== refreshGeneration.current) return;
      setActor(result.actor);
      setSpells(result.spells);
      setProfileId((current) =>
        result.actor.profiles.some((profile) => profile.profileId === current)
          ? current
          : result.actor.profiles[0]?.profileId || '',
      );
    } catch (caught) {
      if (generation !== refreshGeneration.current) return;
      setStatus(
        caught instanceof Error
          ? caught.message
          : 'Spellbook could not be loaded.',
      );
    } finally {
      if (generation === refreshGeneration.current) setLoading(false);
    }
  }, [campaignId, link.id, user.id, canControl]);

  useEffect(() => {
    // Synchronize with committed server state; setters run after the request.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
    return () => {
      refreshGeneration.current += 1;
    };
  }, [refresh]);
  useEffect(() => {
    const reload = () => {
      if (!document.hidden) void refresh();
    };
    window.addEventListener('online', reload);
    window.addEventListener('nexus-domain-command-executed', reload);
    window.addEventListener('nexus-campaign-actors-changed', reload);
    document.addEventListener('visibilitychange', reload);
    return () => {
      window.removeEventListener('online', reload);
      window.removeEventListener('nexus-domain-command-executed', reload);
      window.removeEventListener('nexus-campaign-actors-changed', reload);
      document.removeEventListener('visibilitychange', reload);
    };
  }, [refresh]);

  const profile = actor?.profiles.find(
    (entry) => entry.profileId === profileId,
  );
  const prepared =
    preparationEdits[profileId] ?? profile?.preparedSpellSlugs ?? [];
  const setPrepared = (update: (current: string[]) => string[]) =>
    setPreparationEdits((current) => ({
      ...current,
      [profileId]: update(
        current[profileId] ?? profile?.preparedSpellSlugs ?? [],
      ),
    }));
  const slots = profile
    ? actor?.pools[profile.resourcePoolId]?.slots || {}
    : {};
  const eligible = new Set([
    ...(profile?.knownSpellSlugs || []),
    ...(profile?.preparedSpellSlugs || []),
  ]);
  const available = spells.filter((spell) => eligible.has(spell.slug));

  const execute = async (operation: () => Promise<CommandExecutionResult>) => {
    if (inFlight.current || !canControl) return;
    inFlight.current = true;
    setPending(true);
    setRetry({ operation });
    try {
      const result = await operation();
      if (result.uncertain)
        setStatus(
          'The command outcome is not confirmed. Retry confirmation before taking another spell action.',
        );
      else {
        setRetry(undefined);
        if (result.success) setPreparationEdits({});
        setStatus(
          result.success
            ? 'Change committed to the campaign.'
            : result.error || 'The campaign rejected this action.',
        );
        await refresh();
      }
      return !result.uncertain && result.success;
    } catch (caught) {
      setStatus(
        caught instanceof Error
          ? caught.message
          : 'Could not confirm the action. Retry confirmation.',
      );
      return false;
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  };

  const disabled = pending || Boolean(retry) || !canControl;
  const restControls = actor && (
    <>
      <label>
        Hit dice to spend on a short rest
        <input
          type="number"
          min={0}
          max={actor.pools['feature:hit-dice']?.current ?? 0}
          value={hitDiceToSpend}
          disabled={disabled}
          onChange={(event) =>
            setHitDiceToSpend(
              Math.max(0, Math.floor(Number(event.target.value) || 0)),
            )
          }
        />
      </label>
      <div className={styles.restActions}>
        {(['short', 'long'] as const).map((restType) => (
          <button
            key={restType}
            disabled={disabled}
            onClick={() => {
              if (!campaignId) return;
              const commandId = crypto.randomUUID();
              void execute(() =>
                commandClient.restActor(campaignId, actor.id, restType, {
                  expectedVersion: actor.stateVersion,
                  commandId,
                  hitDiceToSpend: restType === 'short' ? hitDiceToSpend : 0,
                }),
              );
            }}
          >
            {restType === 'short' ? 'Short Rest' : 'Long Rest'}
          </button>
        ))}
      </div>
    </>
  );
  const cast = (spell: SpellDefinition) => {
    if (!actor || !profile || !campaignId) return;
    const pool = actor.pools[profile.resourcePoolId];
    const level =
      spell.level === 0
        ? 0
        : ['uses', 'at-will'].includes(pool?.poolType ?? '')
          ? spell.level
          : levels[spell.slug] || spell.level;
    const commandId = crypto.randomUUID();
    void execute(() =>
      commandClient.castSpell(
        campaignId,
        actor.id,
        { kind: 'spell', id: spell.id, revision: spell.revision },
        profile.profileId,
        level,
        { expectedVersion: actor.stateVersion, commandId },
      ),
    );
  };

  return (
    <section
      className={styles.container}
      aria-label="Spellbook"
      data-testid="spellbook-panel"
    >
      <h2 className={styles.title}>
        {character?.name || link.title || 'Character'} — Spellbook
      </h2>
      {status && <p role="status">{status}</p>}
      {!campaignId && (
        <p role="status">
          Join a campaign session to use its spellcasting controls.
        </p>
      )}
      {campaignId && loading ? (
        <p role="status">Loading campaign spellcasting…</p>
      ) : (
        <>
          <button
            type="button"
            disabled={pending}
            onClick={() => void refresh()}
          >
            Refresh spellbook
          </button>
          {retry && (
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                const operation = retry.operation;
                if (operation) void execute(operation);
              }}
            >
              Retry confirmation
            </button>
          )}
          {actor && (
            <ClassResourceControls
              disabled={disabled}
              resources={Object.values(actor.pools)
                .filter(
                  (pool) =>
                    Boolean(pool.classResourceId) &&
                    pool.classResourceId !== 'hit-dice',
                )
                .map((pool) => ({
                  id: pool.classResourceId!,
                  name: pool.name,
                  description: pool.description ?? '',
                  manualRecovery: pool.description,
                  maxUses: pool.max ?? 0,
                  currentUses: pool.current,
                  unlimited: pool.unlimited,
                  active: pool.active,
                  recovery: pool.recovery,
                  cooldown: pool.cooldown,
                  rechargeType:
                    pool.resetOn === 'dawn'
                      ? 'daily'
                      : pool.resetOn === 'manual'
                        ? 'none'
                        : pool.resetOn,
                }))}
              onConsume={async (resourceId, amount) => {
                if (!campaignId) throw new Error('Join a campaign first.');
                const commandId = crypto.randomUUID();
                const success = await execute(() =>
                  commandClient.consumeClassResource(
                    campaignId,
                    actor.id,
                    resourceId,
                    amount,
                    { expectedVersion: actor.stateVersion, commandId },
                  ),
                );
                if (!success)
                  throw new Error('Resource use was not confirmed.');
              }}
              onRecord={async (resourceId, currentUses, cooldown) => {
                if (!campaignId) throw new Error('No active campaign.');
                const commandId = crypto.randomUUID();
                const success = await execute(() =>
                  commandClient.recordClassResource(
                    campaignId,
                    actor.id,
                    resourceId,
                    currentUses,
                    cooldown,
                    { expectedVersion: actor.stateVersion, commandId },
                  ),
                );
                if (!success)
                  throw new Error('Resource record was not confirmed.');
              }}
            />
          )}
          {actor && !profile && restControls}
          {!actor || !profile ? (
            <p>
              No casting profile is available. Check admission and character
              choices with the DM.
            </p>
          ) : (
            <>
              <label>
                Casting source{' '}
                <select
                  aria-label="Casting source"
                  value={profileId}
                  disabled={pending}
                  onChange={(event) => setProfileId(event.target.value)}
                >
                  {actor.profiles.map((entry) => (
                    <option key={entry.profileId} value={entry.profileId}>
                      {entry.name}
                    </option>
                  ))}
                </select>
              </label>
              <p>
                {profile.spellcastingAbility} · Save DC {profile.spellSaveDC} ·
                Attack {profile.spellAttackBonus >= 0 ? '+' : ''}
                {profile.spellAttackBonus}
              </p>
              <div className={styles.slotsGrid} aria-label="Spell slots">
                {Object.entries(slots).map(([level, slot]) => (
                  <p key={level}>
                    Level {level}: {slot.current} / {slot.total}
                  </p>
                ))}
              </div>
              {actor.concentration && (
                <div className={styles.concentrationBanner}>
                  Concentrating on {actor.concentration.spellName}
                  <button
                    disabled={disabled}
                    onClick={() => {
                      if (!campaignId || !actor.concentration) return;
                      const castId = actor.concentration.castId;
                      const commandId = crypto.randomUUID();
                      void execute(() =>
                        commandClient.endConcentration(
                          campaignId,
                          actor.id,
                          castId,
                          { expectedVersion: actor.stateVersion, commandId },
                        ),
                      );
                    }}
                  >
                    End concentration
                  </button>
                </div>
              )}
              {profile.preparationMode === 'prepared' && (
                <button
                  disabled={disabled}
                  onClick={() => {
                    if (!campaignId) return;
                    const commandId = crypto.randomUUID();
                    void execute(() =>
                      commandClient.applyPreparationPlan(
                        campaignId,
                        actor.id,
                        profile.profileId,
                        prepared,
                        { expectedVersion: actor.stateVersion, commandId },
                      ),
                    );
                  }}
                >
                  Apply preparation
                </button>
              )}
              {available.length === 0 && (
                <p>No spells are available in this casting source.</p>
              )}
              <div className={styles.spellList}>
                {available.map((spell) => {
                  const castLevel = levels[spell.slug] || spell.level;
                  const pool = actor.pools[profile.resourcePoolId];
                  const noSlot =
                    spell.level > 0 &&
                    pool?.poolType !== 'at-will' &&
                    (pool?.poolType === 'uses'
                      ? (pool.current ?? 0) < 1
                      : (slots[String(castLevel)]?.current || 0) < 1);
                  const notPrepared =
                    profile.preparationMode === 'prepared' &&
                    spell.level > 0 &&
                    !profile.preparedSpellSlugs.includes(spell.slug);
                  return (
                    <article className={styles.spellItem} key={spell.id}>
                      <details>
                        <summary>
                          {spell.name}{' '}
                          {spell.level === 0
                            ? '(Cantrip)'
                            : `(Level ${spell.level})`}
                        </summary>
                        <p>{spell.description}</p>
                        <p>
                          {spell.castingTime} · {spell.range} · {spell.duration}
                        </p>
                      </details>
                      {profile.preparationMode === 'prepared' &&
                        spell.level > 0 && (
                          <label>
                            <input
                              type="checkbox"
                              aria-label={`Prepare ${spell.name}`}
                              disabled={disabled}
                              checked={prepared.includes(spell.slug)}
                              onChange={() =>
                                setPrepared((current) =>
                                  current.includes(spell.slug)
                                    ? current.filter(
                                        (slug) => slug !== spell.slug,
                                      )
                                    : [...current, spell.slug],
                                )
                              }
                            />
                            Prepared
                          </label>
                        )}
                      {spell.level > 0 &&
                        !['uses', 'at-will'].includes(pool?.poolType ?? '') && (
                          <select
                            aria-label={`Slot level for ${spell.name}`}
                            value={castLevel}
                            disabled={disabled}
                            onChange={(event) =>
                              setLevels((current) => ({
                                ...current,
                                [spell.slug]: Number(event.target.value),
                              }))
                            }
                          >
                            {Object.entries(slots)
                              .filter(([level]) => Number(level) >= spell.level)
                              .map(([level, slot]) => (
                                <option key={level} value={level}>
                                  Level {level} ({slot.current} left)
                                </option>
                              ))}
                          </select>
                        )}
                      <button
                        disabled={disabled || noSlot || notPrepared}
                        onClick={() => cast(spell)}
                        aria-label={`Cast ${spell.name}${profile.ritualOnly ? ' as a ritual' : ''}`}
                      >
                        {profile.ritualOnly
                          ? 'Cast ritual (+10 minutes)'
                          : pool?.poolType === 'at-will'
                            ? 'Cast at will'
                            : 'Cast'}
                      </button>
                    </article>
                  );
                })}
              </div>
              {restControls}
            </>
          )}
        </>
      )}
    </section>
  );
};
