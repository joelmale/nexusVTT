import Calendar from 'lucide-react/dist/esm/icons/calendar';
import Check from 'lucide-react/dist/esm/icons/check';
import ChevronDown from 'lucide-react/dist/esm/icons/chevron-down';
import ChevronUp from 'lucide-react/dist/esm/icons/chevron-up';
import Clock from 'lucide-react/dist/esm/icons/clock';
import Compass from 'lucide-react/dist/esm/icons/compass';
import FileText from 'lucide-react/dist/esm/icons/file-text';
import MapPin from 'lucide-react/dist/esm/icons/map-pin';
import Play from 'lucide-react/dist/esm/icons/play';
import Plus from 'lucide-react/dist/esm/icons/plus';
import Sparkles from 'lucide-react/dist/esm/icons/sparkles';
import Swords from 'lucide-react/dist/esm/icons/swords';
import Trash2 from 'lucide-react/dist/esm/icons/trash-2';
import Users from 'lucide-react/dist/esm/icons/users';
import X from 'lucide-react/dist/esm/icons/x';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import type { CampaignFixtureBundle } from '@/demo/fixture-registry';
import type {
  CampaignSession,
  ReadinessItem,
  SessionPlan,
  SessionPlanStep,
} from '@/demo/ashes-of-veyra/types';
import type { BundleStore } from '@/features/section-shell/bundleStore';

import { generateSessionSpine } from './sessionSpineGenerator';
import styles from './SessionPlannerModal.module.css';

export interface SessionPlannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  bundle: CampaignFixtureBundle;
  store: BundleStore;
  basePath: string;
  initialSession?: CampaignSession;
  onSessionSaved?: (session: CampaignSession, openRunSheet: boolean) => void;
}

type TabKey = 'basics' | 'hub' | 'spine' | 'prep';

export function SessionPlannerModal({
  isOpen,
  onClose,
  bundle,
  store,
  basePath,
  initialSession,
  onSessionSaved,
}: SessionPlannerModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const navigate = useNavigate();
  const titleId = useId();

  const [activeTab, setActiveTab] = useState<TabKey>('basics');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Tab 1: Basics
  const defaultNumber = useMemo(() => {
    if (initialSession) return initialSession.number;
    const maxNum = bundle.sessions.reduce(
      (max, s) => Math.max(max, s.number),
      0,
    );
    return maxNum + 1;
  }, [bundle.sessions, initialSession]);

  const [sessionNumber, setSessionNumber] = useState(defaultNumber);
  const [title, setTitle] = useState(initialSession?.title ?? '');
  const [actId, setActId] = useState(
    initialSession?.actId ?? bundle.acts[0]?.id ?? '',
  );
  const [plannedDate, setPlannedDate] = useState(
    initialSession?.plannedDate ?? new Date().toISOString().slice(0, 10),
  );
  const [partyLevel, setPartyLevel] = useState(
    initialSession?.partyLevel ?? 3,
  );
  const [targetDurationHours, setTargetDurationHours] = useState(
    initialSession?.durationHours ?? 4,
  );
  const [status, setStatus] = useState<'planned' | 'draft'>(
    initialSession?.status === 'complete'
      ? 'planned'
      : (initialSession?.status ?? 'planned'),
  );
  const [summary, setSummary] = useState(initialSession?.summary ?? '');

  // Tab 2: Campaign Hub connections
  const [selectedQuestIds, setSelectedQuestIds] = useState<Set<string>>(
    new Set(initialSession?.questIds ?? []),
  );
  const [selectedObjectiveIds, setSelectedObjectiveIds] = useState<Set<string>>(
    new Set(),
  );
  const [primaryLocationId, setPrimaryLocationId] = useState<string>(
    initialSession?.locationIds[0] ?? bundle.locations[0]?.id ?? '',
  );
  const [selectedEncounterIds, setSelectedEncounterIds] = useState<Set<string>>(
    new Set(initialSession?.encounterIds ?? []),
  );
  const [selectedNpcIds, setSelectedNpcIds] = useState<Set<string>>(
    new Set(initialSession?.npcIds ?? []),
  );
  const [selectedFactionIds, setSelectedFactionIds] = useState<Set<string>>(
    new Set(initialSession?.factionIds ?? []),
  );
  const [selectedHandoutIds, setSelectedHandoutIds] = useState<Set<string>>(
    new Set(initialSession?.handoutIds ?? []),
  );
  const [selectedClueIds, setSelectedClueIds] = useState<Set<string>>(
    new Set(initialSession?.clueIds ?? []),
  );

  // Tab 3: Run-sheet beats spine
  const [steps, setSteps] = useState<SessionPlanStep[]>(
    initialSession?.plan?.steps ?? [],
  );

  // Tab 4: DM Prep & Readiness
  const [readiness, setReadiness] = useState<ReadinessItem[]>(
    initialSession?.plan?.readiness ?? [],
  );
  const [dmNotes, setDmNotes] = useState(
    initialSession?.plan?.notes?.join('\n') ?? '',
  );
  const [playerFacingSummary, setPlayerFacingSummary] = useState(
    initialSession?.plan?.playerFacingSummary ?? '',
  );

  // Auto-generate initial spine if no pre-existing plan steps
  useEffect(() => {
    if (steps.length === 0 && isOpen) {
      const prevSession = bundle.sessions.find(
        (s) => s.number === defaultNumber - 1,
      );
      const generated = generateSessionSpine({
        sessionNumber: defaultNumber,
        campaignTitle: bundle.campaign.title,
        targetDurationMinutes: targetDurationHours * 60,
        previousSession: prevSession,
        primaryLocation: bundle.locations.find((l) => l.id === primaryLocationId),
        quests: bundle.quests.filter((q) => selectedQuestIds.has(q.id)),
        encounters: bundle.encounters.filter((e) => selectedEncounterIds.has(e.id)),
        npcs: bundle.npcs.filter((n) => selectedNpcIds.has(n.id)),
        factions: bundle.factions.filter((f) => selectedFactionIds.has(f.id)),
        handouts: bundle.handouts.filter((h) => selectedHandoutIds.has(h.id)),
        clues: bundle.clues.filter((c) => selectedClueIds.has(c.id)),
      });

      setSteps(generated.plan.steps);
      setReadiness(generated.plan.readiness);
      if (!title) {
        setTitle(initialSession?.title || generated.suggestedTitle);
      }
      if (!summary) {
        setSummary(initialSession?.summary || generated.suggestedSummary);
      }
      if (!playerFacingSummary) {
        setPlayerFacingSummary(generated.playerFacingSummary);
      }
    }
  }, [defaultNumber, isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  // Dialog management
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isOpen && !dialog.open) {
      dialog.showModal();
    } else if (!isOpen && dialog.open) {
      dialog.close();
    }
  }, [isOpen]);

  const handleRegenerateSpine = () => {
    const prevSession = bundle.sessions.find(
      (s) => s.number === sessionNumber - 1,
    );
    const selectedQuests = bundle.quests.filter((q) =>
      selectedQuestIds.has(q.id),
    );
    const selectedObjectives = bundle.quests
      .flatMap((q) => q.objectiveIds)
      .filter((id) => selectedObjectiveIds.has(id))
      .map((id) => ({
        id,
        questId: '',
        order: 1,
        title: id.replace(/-/g, ' '),
        status: 'active' as const,
        clueIds: [],
        locationIds: [],
      }));

    const generated = generateSessionSpine({
      sessionNumber,
      campaignTitle: bundle.campaign.title,
      targetDurationMinutes: targetDurationHours * 60,
      previousSession: prevSession,
      primaryLocation: bundle.locations.find((l) => l.id === primaryLocationId),
      quests: selectedQuests,
      objectives: selectedObjectives,
      encounters: bundle.encounters.filter((e) => selectedEncounterIds.has(e.id)),
      npcs: bundle.npcs.filter((n) => selectedNpcIds.has(n.id)),
      factions: bundle.factions.filter((f) => selectedFactionIds.has(f.id)),
      handouts: bundle.handouts.filter((h) => selectedHandoutIds.has(h.id)),
      clues: bundle.clues.filter((c) => selectedClueIds.has(c.id)),
    });

    setSteps(generated.plan.steps);
    setReadiness(generated.plan.readiness);
    if (!title || title.startsWith('Session ')) {
      setTitle(generated.suggestedTitle);
    }
    if (!summary) {
      setSummary(generated.suggestedSummary);
    }
    setPlayerFacingSummary(generated.playerFacingSummary);
  };

  const totalStepMinutes = useMemo(() => {
    return steps.reduce((sum, s) => sum + (Number(s.durationMinutes) || 0), 0);
  }, [steps]);

  const handleAddStep = () => {
    const newStep: SessionPlanStep = {
      id: `step-${Date.now()}`,
      order: steps.length + 1,
      kind: 'scene',
      track: 'main',
      title: 'New Scene Beat',
      durationMinutes: 30,
      visibility: 'shared',
      body: '',
    };
    setSteps([...steps, newStep]);
  };

  const handleRemoveStep = (index: number) => {
    setSteps(steps.filter((_, idx) => idx !== index));
  };

  const handleMoveStep = (index: number, direction: 'up' | 'down') => {
    if (
      (direction === 'up' && index === 0) ||
      (direction === 'down' && index === steps.length - 1)
    ) {
      return;
    }
    const nextSteps = [...steps];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    const temp = nextSteps[index];
    nextSteps[index] = nextSteps[targetIndex];
    nextSteps[targetIndex] = temp;
    nextSteps.forEach((s, idx) => {
      s.order = idx + 1;
    });
    setSteps(nextSteps);
  };

  const handleUpdateStep = (
    index: number,
    patch: Partial<SessionPlanStep>,
  ) => {
    const nextSteps = [...steps];
    nextSteps[index] = { ...nextSteps[index], ...patch };
    setSteps(nextSteps);
  };

  const handleToggleQuest = (questId: string) => {
    const next = new Set(selectedQuestIds);
    if (next.has(questId)) {
      next.delete(questId);
    } else {
      next.add(questId);
    }
    setSelectedQuestIds(next);
  };

  const handleToggleEncounter = (encounterId: string) => {
    const next = new Set(selectedEncounterIds);
    if (next.has(encounterId)) {
      next.delete(encounterId);
    } else {
      next.add(encounterId);
    }
    setSelectedEncounterIds(next);
  };

  const handleToggleNpc = (npcId: string) => {
    const next = new Set(selectedNpcIds);
    if (next.has(npcId)) {
      next.delete(npcId);
    } else {
      next.add(npcId);
    }
    setSelectedNpcIds(next);
  };

  const handleToggleFaction = (factionId: string) => {
    const next = new Set(selectedFactionIds);
    if (next.has(factionId)) {
      next.delete(factionId);
    } else {
      next.add(factionId);
    }
    setSelectedFactionIds(next);
  };

  const handleToggleHandout = (handoutId: string) => {
    const next = new Set(selectedHandoutIds);
    if (next.has(handoutId)) {
      next.delete(handoutId);
    } else {
      next.add(handoutId);
    }
    setSelectedHandoutIds(next);
  };

  const handleToggleObjective = (objectiveId: string) => {
    const next = new Set(selectedObjectiveIds);
    if (next.has(objectiveId)) {
      next.delete(objectiveId);
    } else {
      next.add(objectiveId);
    }
    setSelectedObjectiveIds(next);
  };

  const handleToggleClue = (clueId: string) => {
    const next = new Set(selectedClueIds);
    if (next.has(clueId)) {
      next.delete(clueId);
    } else {
      next.add(clueId);
    }
    setSelectedClueIds(next);
  };

  const handleToggleReadiness = (index: number) => {
    const next = [...readiness];
    next[index] = { ...next[index], complete: !next[index].complete };
    setReadiness(next);
  };

  const handleSave = async (openRunSheet: boolean) => {
    if (!title.trim()) {
      setErrorMessage('Session title is required.');
      setActiveTab('basics');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    const sessionId = initialSession?.id ?? `session-${sessionNumber}`;

    const plan: SessionPlan = {
      revision: (initialSession?.plan?.revision ?? 0) + 1,
      lastEdited: new Date().toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }),
      estimatedMinutes: totalStepMinutes,
      readiness,
      dependencies: [
        ...(primaryLocationId ? [{ objectId: primaryLocationId, status: 'ready' as const }] : []),
        ...[...selectedEncounterIds].map((id) => ({ objectId: id, status: 'ready' as const })),
        ...[...selectedNpcIds].map((id) => ({ objectId: id, status: 'ready' as const })),
        ...[...selectedHandoutIds].map((id) => ({ objectId: id, status: 'ready' as const })),
      ],
      steps,
      notes: dmNotes.split('\n').filter(Boolean),
      playerFacingSummary,
      attachments: [...selectedHandoutIds],
    };

    const sessionData: CampaignSession = {
      id: sessionId,
      campaignId: bundle.campaign.id,
      actId,
      number: Number(sessionNumber) || 1,
      title: title.trim(),
      status,
      summary: summary.trim(),
      plannedDate,
      durationHours: Number(targetDurationHours) || 4,
      partyLevel: Number(partyLevel) || 1,
      tags: initialSession?.tags ?? ['planned-session'],
      questIds: [...selectedQuestIds],
      locationIds: primaryLocationId ? [primaryLocationId] : [],
      encounterIds: [...selectedEncounterIds],
      npcIds: [...selectedNpcIds],
      factionIds: [...selectedFactionIds],
      handoutIds: [...selectedHandoutIds],
      clueIds: [...selectedClueIds],
      plan,
    };

    try {
      if (initialSession) {
        const res = await store.updateItem(
          'session',
          initialSession.id,
          sessionData as unknown as Record<string, unknown>,
        );
        if (!res.ok) {
          throw new Error(res.error || 'Failed to update session.');
        }
      } else {
        const res = await store.addItem(
          'session',
          sessionData as unknown as Record<string, unknown>,
        );
        if (!res.ok) {
          throw new Error(res.error || 'Failed to create session.');
        }
      }

      onSessionSaved?.(sessionData, openRunSheet);
      onClose();

      if (openRunSheet) {
        navigate(`${basePath}/sessions/${sessionId}/plan`);
      }
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'An error occurred while saving the session.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      aria-labelledby={titleId}
      onCancel={onClose}
    >
      <div className={styles.form}>
        {/* Header */}
        <div className={styles.header}>
          <div>
            <h3 id={titleId} className={styles.title}>
              <Sparkles size={20} color="var(--studio-primary, #4f46e5)" />
              {initialSession
                ? `Plan Session #${initialSession.number}: ${initialSession.title}`
                : `Plan a Session (#${sessionNumber})`}
            </h3>
            <p className={styles.subtitle}>
              Assemble quests, encounters, locations, and run-sheet narrative beats for your campaign.
            </p>
          </div>
          <button
            type="button"
            className={styles.closeButton}
            onClick={onClose}
            aria-label="Close session planner"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className={styles.tabsBar}>
          <button
            type="button"
            className={`${styles.tabButton} ${activeTab === 'basics' ? styles.activeTab : ''}`}
            onClick={() => setActiveTab('basics')}
            data-testid="tab-basics"
          >
            <Calendar size={14} />
            Basics & Pacing
          </button>
          <button
            type="button"
            className={`${styles.tabButton} ${activeTab === 'hub' ? styles.activeTab : ''}`}
            onClick={() => setActiveTab('hub')}
            data-testid="tab-hub"
          >
            <Compass size={14} />
            Campaign Hub
            <span className={styles.badge}>
              {selectedQuestIds.size +
                selectedEncounterIds.size +
                selectedNpcIds.size +
                (primaryLocationId ? 1 : 0)}
            </span>
          </button>
          <button
            type="button"
            className={`${styles.tabButton} ${activeTab === 'spine' ? styles.activeTab : ''}`}
            onClick={() => setActiveTab('spine')}
            data-testid="tab-spine"
          >
            <Play size={14} />
            Run-Sheet Beats
            <span className={styles.badge}>{steps.length}</span>
          </button>
          <button
            type="button"
            className={`${styles.tabButton} ${activeTab === 'prep' ? styles.activeTab : ''}`}
            onClick={() => setActiveTab('prep')}
            data-testid="tab-prep"
          >
            <Check size={14} />
            DM Prep & Readiness
          </button>
        </div>

        {/* Body Content */}
        <div className={styles.body}>
          {/* TAB 1: BASICS */}
          {activeTab === 'basics' && (
            <div className={styles.basicsGrid}>
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel} htmlFor="session-num">
                  Session Number
                </label>
                <input
                  id="session-num"
                  type="number"
                  min="1"
                  className={styles.fieldInput}
                  value={sessionNumber}
                  onChange={(e) => setSessionNumber(parseInt(e.target.value, 10) || 1)}
                  data-testid="input-session-number"
                />
              </div>

              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel} htmlFor="session-title">
                  Session Title
                </label>
                <input
                  id="session-title"
                  type="text"
                  className={styles.fieldInput}
                  placeholder="e.g. The Sunken Scriptorium"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  data-testid="input-session-title"
                />
              </div>

              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel} htmlFor="session-act">
                  Campaign Act
                </label>
                <select
                  id="session-act"
                  className={styles.fieldSelect}
                  value={actId}
                  onChange={(e) => setActId(e.target.value)}
                >
                  <option value="">No Act Assigned</option>
                  {bundle.acts.map((act) => (
                    <option key={act.id} value={act.id}>
                      {act.title}
                    </option>
                  ))}
                </select>
              </div>

              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel} htmlFor="session-date">
                  Planned Date
                </label>
                <input
                  id="session-date"
                  type="date"
                  className={styles.fieldInput}
                  value={plannedDate}
                  onChange={(e) => setPlannedDate(e.target.value)}
                />
              </div>

              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel} htmlFor="session-level">
                  Party Level
                </label>
                <input
                  id="session-level"
                  type="number"
                  min="1"
                  max="20"
                  className={styles.fieldInput}
                  value={partyLevel}
                  onChange={(e) => setPartyLevel(parseInt(e.target.value, 10) || 1)}
                />
              </div>

              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel} htmlFor="session-duration">
                  Target Duration (Hours)
                </label>
                <select
                  id="session-duration"
                  className={styles.fieldSelect}
                  value={targetDurationHours}
                  onChange={(e) => setTargetDurationHours(parseFloat(e.target.value) || 4)}
                >
                  <option value="2">2 Hours (~120 min)</option>
                  <option value="3">3 Hours (~180 min)</option>
                  <option value="4">4 Hours (~240 min)</option>
                  <option value="5">5 Hours (~300 min)</option>
                </select>
              </div>

              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel} htmlFor="session-status">
                  Lifecycle Status
                </label>
                <select
                  id="session-status"
                  className={styles.fieldSelect}
                  value={status}
                  onChange={(e) => setStatus(e.target.value as 'planned' | 'draft')}
                >
                  <option value="planned">Planned (Ready for Game Day)</option>
                  <option value="draft">Draft (In Preparation)</option>
                </select>
              </div>

              <div className={styles.fieldGroup} style={{ gridColumn: '1 / -1' }}>
                <label className={styles.fieldLabel} htmlFor="session-summary">
                  Campaign Overview / Synopsis
                </label>
                <textarea
                  id="session-summary"
                  className={styles.fieldTextarea}
                  placeholder="Summary of this session's core narrative arc..."
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  data-testid="input-session-summary"
                />
              </div>
            </div>
          )}

          {/* TAB 2: CAMPAIGN HUB CONNECTIONS */}
          {activeTab === 'hub' && (
            <>
              {/* Primary Location */}
              <div className={styles.hubCategory}>
                <div className={styles.categoryTitle}>
                  <MapPin size={16} color="var(--studio-primary, #4f46e5)" />
                  Primary Location / Setting
                </div>
                <select
                  className={styles.fieldSelect}
                  value={primaryLocationId}
                  onChange={(e) => setPrimaryLocationId(e.target.value)}
                  data-testid="select-primary-location"
                >
                  <option value="">No Location Linked</option>
                  {bundle.locations.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.name} ({loc.type})
                    </option>
                  ))}
                </select>
              </div>

              {/* Active Quests */}
              <div className={styles.hubCategory}>
                <div className={styles.categoryTitle}>
                  <Compass size={16} color="#d97706" />
                  Active Quests & Objectives
                </div>
                <div className={styles.chipGrid}>
                  {bundle.quests.map((q) => {
                    const active = selectedQuestIds.has(q.id);
                    return (
                      <div key={q.id} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div
                          className={`${styles.selectionCard} ${active ? styles.selectionCardActive : ''}`}
                          onClick={() => handleToggleQuest(q.id)}
                          data-testid={`chip-quest-${q.id}`}
                        >
                          <Compass size={14} />
                          <span>{q.title}</span>
                          <span className={styles.metaPill}>{q.status}</span>
                        </div>
                        {active && q.objectiveIds.length > 0 && (
                          <div className={styles.objectiveList}>
                            {q.objectiveIds.map((objId) => {
                              const isChecked = selectedObjectiveIds.has(objId);
                              return (
                                <label key={objId} className={styles.objectiveItem}>
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() => handleToggleObjective(objId)}
                                    data-testid={`checkbox-obj-${objId}`}
                                  />
                                  <span>{objId.replace(/-/g, ' ')}</span>
                                </label>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Encounters */}
              <div className={styles.hubCategory}>
                <div className={styles.categoryTitle}>
                  <Swords size={16} color="#dc2626" />
                  Campaign Encounters & Hazards
                </div>
                <div className={styles.chipGrid}>
                  {bundle.encounters.map((enc) => {
                    const active = selectedEncounterIds.has(enc.id);
                    return (
                      <div
                        key={enc.id}
                        className={`${styles.selectionCard} ${active ? styles.selectionCardActive : ''}`}
                        onClick={() => handleToggleEncounter(enc.id)}
                        data-testid={`chip-encounter-${enc.id}`}
                      >
                        <Swords size={14} />
                        <span>{enc.title}</span>
                        <span className={styles.metaPill}>
                          {enc.kind} · {enc.difficulty}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* NPCs */}
              <div className={styles.hubCategory}>
                <div className={styles.categoryTitle}>
                  <Users size={16} color="#2563eb" />
                  Key NPCs Featured
                </div>
                <div className={styles.chipGrid}>
                  {bundle.npcs.map((npc) => {
                    const active = selectedNpcIds.has(npc.id);
                    return (
                      <div
                        key={npc.id}
                        className={`${styles.selectionCard} ${active ? styles.selectionCardActive : ''}`}
                        onClick={() => handleToggleNpc(npc.id)}
                        data-testid={`chip-npc-${npc.id}`}
                      >
                        <Users size={14} />
                        <span>{npc.name}</span>
                        <span className={styles.metaPill}>{npc.role}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Factions */}
              {bundle.factions.length > 0 && (
                <div className={styles.hubCategory}>
                  <div className={styles.categoryTitle}>
                    <Users size={16} color="#7c3aed" />
                    Factions & Agendas
                  </div>
                  <div className={styles.chipGrid}>
                    {bundle.factions.map((f) => {
                      const active = selectedFactionIds.has(f.id);
                      return (
                        <div
                          key={f.id}
                          className={`${styles.selectionCard} ${active ? styles.selectionCardActive : ''}`}
                          onClick={() => handleToggleFaction(f.id)}
                          data-testid={`chip-faction-${f.id}`}
                        >
                          <span>{f.name}</span>
                          <span className={styles.metaPill}>{f.status}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Handouts */}
              {bundle.handouts.length > 0 && (
                <div className={styles.hubCategory}>
                  <div className={styles.categoryTitle}>
                    <FileText size={16} color="#059669" />
                    Handouts & Documents
                  </div>
                  <div className={styles.chipGrid}>
                    {bundle.handouts.map((h) => {
                      const active = selectedHandoutIds.has(h.id);
                      return (
                        <div
                          key={h.id}
                          className={`${styles.selectionCard} ${active ? styles.selectionCardActive : ''}`}
                          onClick={() => handleToggleHandout(h.id)}
                          data-testid={`chip-handout-${h.id}`}
                        >
                          <FileText size={14} />
                          <span>{h.title}</span>
                          <span className={styles.metaPill}>{h.visibility}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Clues */}
              {bundle.clues && bundle.clues.length > 0 && (
                <div className={styles.hubCategory}>
                  <div className={styles.categoryTitle}>
                    <FileText size={16} color="#d97706" />
                    Clues & Mysteries
                  </div>
                  <div className={styles.chipGrid}>
                    {bundle.clues.map((c) => {
                      const active = selectedClueIds.has(c.id);
                      return (
                        <div
                          key={c.id}
                          className={`${styles.selectionCard} ${active ? styles.selectionCardActive : ''}`}
                          onClick={() => handleToggleClue(c.id)}
                          data-testid={`chip-clue-${c.id}`}
                        >
                          <FileText size={14} />
                          <span>{c.title}</span>
                          <span className={styles.metaPill}>{c.priority}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}

          {/* TAB 3: RUN SHEET SPINE BEATS */}
          {activeTab === 'spine' && (
            <>
              <div className={styles.spineHeader}>
                <div className={styles.timeBudget}>
                  <Clock size={16} color="var(--studio-primary, #4f46e5)" />
                  <span>
                    Run-Sheet Duration: <strong>{totalStepMinutes} min</strong> / ~
                    {targetDurationHours * 60} min target
                  </span>
                </div>
                <button
                  type="button"
                  className={styles.generateBtn}
                  onClick={handleRegenerateSpine}
                  title="Auto-synthesize beats from selected campaign elements"
                  data-testid="generate-spine-btn"
                >
                  <Sparkles size={14} />
                  Auto-Generate Beat Spine
                </button>
              </div>

              <div className={styles.stepList}>
                {steps.map((step, idx) => (
                  <div key={step.id} className={styles.stepCard} data-testid={`step-card-${idx}`}>
                    <div className={styles.stepHeader}>
                      <span className={styles.stepOrderBadge}>#{idx + 1}</span>
                      <input
                        type="text"
                        className={styles.stepTitleInput}
                        value={step.title}
                        onChange={(e) => handleUpdateStep(idx, { title: e.target.value })}
                        aria-label={`Step ${idx + 1} Title`}
                      />
                      <div className={styles.stepActions}>
                        <button
                          type="button"
                          className={styles.iconBtn}
                          onClick={() => handleMoveStep(idx, 'up')}
                          disabled={idx === 0}
                          title="Move step up"
                          aria-label={`Move Step ${idx + 1} up`}
                        >
                          <ChevronUp size={14} />
                        </button>
                        <button
                          type="button"
                          className={styles.iconBtn}
                          onClick={() => handleMoveStep(idx, 'down')}
                          disabled={idx === steps.length - 1}
                          title="Move step down"
                          aria-label={`Move Step ${idx + 1} down`}
                        >
                          <ChevronDown size={14} />
                        </button>
                        <button
                          type="button"
                          className={`${styles.iconBtn} ${styles.deleteBtn}`}
                          onClick={() => handleRemoveStep(idx)}
                          title="Delete step"
                          aria-label={`Delete Step ${idx + 1}`}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>

                    <div className={styles.stepMetaRow}>
                      <select
                        className={styles.fieldSelect}
                        style={{ width: 'auto', padding: '4px 8px', fontSize: '12px' }}
                        value={step.kind}
                        onChange={(e) =>
                          handleUpdateStep(idx, {
                            kind: e.target.value as SessionPlanStep['kind'],
                          })
                        }
                      >
                        <option value="recap">Opening Recap</option>
                        <option value="scene">Atmospheric Scene</option>
                        <option value="encounter">Combat / Trap Encounter</option>
                        <option value="choice">Decision Point</option>
                        <option value="handout">Share Handout</option>
                        <option value="note">Secret DM Note</option>
                        <option value="closing">Closing Cliffhanger</option>
                      </select>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <input
                          type="number"
                          min="5"
                          step="5"
                          className={styles.fieldInput}
                          style={{ width: '60px', padding: '4px 6px', fontSize: '12px' }}
                          value={step.durationMinutes}
                          onChange={(e) =>
                            handleUpdateStep(idx, {
                              durationMinutes: parseInt(e.target.value, 10) || 15,
                            })
                          }
                          aria-label={`Step ${idx + 1} duration in minutes`}
                        />
                        <span style={{ fontSize: '11px', color: 'var(--studio-text-muted)' }}>min</span>
                      </div>

                      <select
                        className={styles.fieldSelect}
                        style={{ width: 'auto', padding: '4px 8px', fontSize: '12px' }}
                        value={step.track}
                        onChange={(e) =>
                          handleUpdateStep(idx, {
                            track: e.target.value as 'main' | 'parallel',
                          })
                        }
                      >
                        <option value="main">Main Spine Beat</option>
                        <option value="parallel">Parallel / Side Thread</option>
                      </select>

                      <select
                        className={styles.fieldSelect}
                        style={{ width: 'auto', padding: '4px 8px', fontSize: '12px' }}
                        value={step.visibility}
                        onChange={(e) =>
                          handleUpdateStep(idx, {
                            visibility: e.target.value as 'shared' | 'dm-only',
                          })
                        }
                      >
                        <option value="shared">Shared with Players</option>
                        <option value="dm-only">DM Only (Secret)</option>
                      </select>
                    </div>

                    <textarea
                      className={styles.stepBodyTextarea}
                      value={step.body ?? ''}
                      placeholder="DM cues, NPC roleplay notes, sensory descriptions..."
                      onChange={(e) => handleUpdateStep(idx, { body: e.target.value })}
                    />
                  </div>
                ))}

                <button
                  type="button"
                  className={styles.addStepRow}
                  onClick={handleAddStep}
                  data-testid="add-step-btn"
                >
                  <Plus size={14} />
                  Add Custom Run-Sheet Beat
                </button>
              </div>
            </>
          )}

          {/* TAB 4: DM PREP & READINESS */}
          {activeTab === 'prep' && (
            <>
              <div className={styles.hubCategory}>
                <div className={styles.categoryTitle}>
                  <Check size={16} color="var(--studio-primary, #4f46e5)" />
                  Readiness Checklist
                </div>
                <div className={styles.checklistGroup}>
                  {readiness.map((item, idx) => (
                    <label key={item.id} className={styles.checklistItem}>
                      <input
                        type="checkbox"
                        checked={item.complete}
                        onChange={() => handleToggleReadiness(idx)}
                      />
                      <span className={`${styles.checkText} ${item.complete ? styles.checkDone : ''}`}>
                        {item.label}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel} htmlFor="dm-notes">
                  Private DM Prep Notes
                </label>
                <textarea
                  id="dm-notes"
                  className={styles.fieldTextarea}
                  rows={4}
                  placeholder="Scratchpad for pacing, secret reveals, NPC accents, puzzle solutions..."
                  value={dmNotes}
                  onChange={(e) => setDmNotes(e.target.value)}
                />
              </div>

              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel} htmlFor="player-facing">
                  Player-Facing Session Teaser
                </label>
                <textarea
                  id="player-facing"
                  className={styles.fieldTextarea}
                  rows={3}
                  placeholder="Teaser or hook sent to players before game day..."
                  value={playerFacingSummary}
                  onChange={(e) => setPlayerFacingSummary(e.target.value)}
                />
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className={styles.footer}>
          {errorMessage && <div className={styles.errorBanner}>{errorMessage}</div>}
          <button
            type="button"
            className={styles.cancelButton}
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </button>

          <div className={styles.footerActions}>
            <button
              type="button"
              className={styles.saveButton}
              onClick={() => handleSave(false)}
              disabled={isSubmitting}
              data-testid="save-draft-btn"
            >
              Save Session
            </button>
            <button
              type="button"
              className={styles.primaryButton}
              onClick={() => handleSave(true)}
              disabled={isSubmitting}
              data-testid="save-and-open-runsheet-btn"
            >
              <Play size={14} />
              Save & Open Run Sheet
            </button>
          </div>
        </div>
      </div>
    </dialog>
  );
}
