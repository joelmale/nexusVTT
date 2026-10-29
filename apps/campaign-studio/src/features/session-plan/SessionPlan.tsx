import BookOpen from 'lucide-react/dist/esm/icons/book-open';
import Check from 'lucide-react/dist/esm/icons/check';
import ChevronDown from 'lucide-react/dist/esm/icons/chevron-down';
import ChevronRight from 'lucide-react/dist/esm/icons/chevron-right';
import Clock3 from 'lucide-react/dist/esm/icons/clock-3';
import Eye from 'lucide-react/dist/esm/icons/eye';
import FilePenLine from 'lucide-react/dist/esm/icons/file-pen-line';
import FileText from 'lucide-react/dist/esm/icons/file-text';
import GripVertical from 'lucide-react/dist/esm/icons/grip-vertical';
import Link2 from 'lucide-react/dist/esm/icons/link-2';
import ListFilter from 'lucide-react/dist/esm/icons/list-filter';
import MessageSquareText from 'lucide-react/dist/esm/icons/message-square-text';
import MoreHorizontal from 'lucide-react/dist/esm/icons/more-horizontal';
import Play from 'lucide-react/dist/esm/icons/play';
import Plus from 'lucide-react/dist/esm/icons/plus';
import RotateCcw from 'lucide-react/dist/esm/icons/rotate-ccw';
import Search from 'lucide-react/dist/esm/icons/search';
import Send from 'lucide-react/dist/esm/icons/send';
import Sparkles from 'lucide-react/dist/esm/icons/sparkles';
import Swords from 'lucide-react/dist/esm/icons/swords';
import Trash2 from 'lucide-react/dist/esm/icons/trash-2';
import UserRound from 'lucide-react/dist/esm/icons/user-round';
import { useContext, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

import type { CapabilityId } from '@/features/capability-notice';
import {
  createEmptyBundle,
  type CampaignFixtureBundle,
  type CampaignSession,
} from '@/demo/fixture-registry';
import { RevisionHistoryModal } from '@/features/revisions/RevisionHistoryModal';
import { createReadOnlyStore } from '@/features/section-shell/bundleStore';
import {
  SectionContext,
  type SectionContextValue,
} from '@/features/section-shell/SectionContext';
import { RunSheetExportModal } from '@/features/sessions/export/RunSheetExportModal';

import type {
  LibraryObject,
  LibraryObjectType,
  SessionPlanViewModel,
  SessionStepViewModel,
} from './sessionPlanModels';
import styles from './SessionPlan.module.css';
import { toCommandSelectValue, type StepCommandType } from './stepCommand';

interface SessionPlanProps {
  bundle?: CampaignFixtureBundle;
  session?: CampaignSession;
  onAuthoringChange?: (
    patch: Partial<import('@/demo/ashes-of-veyra/types').SessionPlan>,
  ) => void;
  onSaveDraft?: () => void;
  isSaving?: boolean;
  model: SessionPlanViewModel;
  onCapability: (capabilityId: CapabilityId) => void;
  onPublish?: (steps: SessionStepViewModel[]) => void;
  onActivate?: (steps: SessionStepViewModel[]) => void;
  onBeginDraft?: () => void;
  onDirty?: () => void;
  onStepsChange?: (steps: SessionStepViewModel[]) => void;
  publishMessage?: string;
  persistedRevision?: number;
  isDirty?: boolean;
  publishState?: 'idle' | 'publishing' | 'published' | 'error';
  activateState?: 'idle' | 'activating' | 'activated' | 'error';
}

type WorkspaceTab = 'run-sheet' | 'notes' | 'player-facing' | 'attachments';
type InspectorTab = 'details' | 'references' | 'chat-prep';

const TYPE_ICONS: Record<LibraryObjectType, typeof FileText> = {
  encounter: Swords,
  handout: FileText,
  lore: BookOpen,
  npc: UserRound,
  scene: Sparkles,
};

interface ReferencedEntityItem {
  id: string;
  title: string;
  kind: string;
  type: LibraryObjectType;
  source: string;
}

interface BacklinkItem {
  id: string;
  title: string;
  kind: string;
}

export function SessionPlan({
  bundle,
  session,
  onAuthoringChange,
  onSaveDraft,
  isSaving = false,
  model,
  onCapability,
  onPublish,
  onActivate,
  onBeginDraft,
  onDirty,
  onStepsChange,
  publishMessage,
  persistedRevision,
  isDirty = false,
  publishState = 'idle',
  activateState = 'idle',
}: SessionPlanProps) {
  const sectionContext = useContext(SectionContext);
  const [libraryTab, setLibraryTab] = useState<'campaign' | 'compendium'>(
    'campaign',
  );
  const [workspaceTab, setWorkspaceTab] = useState<WorkspaceTab>('run-sheet');
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>('details');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<LibraryObjectType | 'all'>(
    'all',
  );
  const [folderFilter, setFolderFilter] = useState<string | null>(null);

  const [selectedObjectId, setSelectedObjectId] = useState(
    model.recentObjects[0]?.id ?? '',
  );
  const [selectedStepId, setSelectedStepId] = useState(
    model.steps[2]?.id ?? model.steps[0]?.id ?? '',
  );
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(
    new Set([model.folders[1]?.id].filter(Boolean) as string[]),
  );
  const [steps, setSteps] = useState(model.steps);
  const [reorderMode, setReorderMode] = useState(false);
  const dependencies = model.dependencies;
  const [checklist, setChecklist] = useState(model.checklist);
  const [visibility, setVisibility] = useState<'dm-only' | 'shared'>(
    model.authoring?.defaultVisibility ?? 'dm-only',
  );
  const [notes, setNotes] = useState(model.notes);
  const [playerFacing, setPlayerFacing] = useState(model.playerFacing);
  const [attachments, setAttachments] = useState<LibraryObject[]>(
    model.attachments,
  );

  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  const libraryObjects =
    libraryTab === 'campaign' ? model.recentObjects : model.compendiumObjects;

  const availableEntities = useMemo(() => {
    const map = new Map<string, LibraryObject>();
    model.recentObjects.forEach((o) => map.set(o.id, o));
    model.compendiumObjects.forEach((o) => map.set(o.id, o));
    if (bundle) {
      bundle.libraryObjects.forEach((o) => {
        if (!map.has(o.id)) {
          map.set(o.id, {
            id: o.id,
            title: o.title,
            subtitle:
              (o as { subtitle?: string }).subtitle ??
              (o as { updatedLabel?: string }).updatedLabel ??
              o.kind,
            type:
              o.kind === 'faction' || o.kind === 'quest'
                ? 'lore'
                : (o.kind as LibraryObjectType),
          });
        }
      });
    }
    return Array.from(map.values());
  }, [model.recentObjects, model.compendiumObjects, bundle]);

  const filteredObjects = useMemo(() => {
    let list = libraryObjects;
    if (typeFilter !== 'all') {
      list = list.filter((item) => item.type === typeFilter);
    }
    if (folderFilter) {
      const childLabel = (
        folderFilter.includes('::')
          ? folderFilter.split('::')[1]
          : folderFilter.split('-').pop() || ''
      ).toLowerCase();
      const singular = childLabel.replace(/s$/, '');
      list = list.filter((item) => {
        return (
          item.type.toLowerCase() === singular ||
          item.title.toLowerCase().includes(singular) ||
          item.subtitle.toLowerCase().includes(singular)
        );
      });
    }
    const query = search.trim().toLowerCase();
    if (query) {
      list = list.filter((item) =>
        `${item.title} ${item.subtitle} ${item.type}`
          .toLowerCase()
          .includes(query),
      );
    }
    return list;
  }, [libraryObjects, typeFilter, folderFilter, search]);

  const selectedObject = useMemo(
    () => filteredObjects.find((item) => item.id === selectedObjectId),
    [filteredObjects, selectedObjectId],
  );

  const referencedEntities = useMemo<ReferencedEntityItem[]>(() => {
    const map = new Map<string, ReferencedEntityItem>();

    for (const step of steps) {
      if (step.objectId) {
        const found = availableEntities.find((o) => o.id === step.objectId);
        map.set(step.objectId, {
          id: step.objectId,
          kind: found?.subtitle ?? found?.type ?? 'Object',
          source: `Step: ${step.title}`,
          title: found?.title ?? step.referenceLabel ?? step.objectId,
          type: found?.type ?? 'lore',
        });
      }
      if (step.encounterId && step.encounterId !== step.objectId) {
        const found = availableEntities.find((o) => o.id === step.encounterId);
        map.set(step.encounterId, {
          id: step.encounterId,
          kind: 'Encounter',
          source: `Step: ${step.title}`,
          title: found?.title ?? 'Encounter',
          type: 'encounter',
        });
      }
      if (step.sceneTemplateId && step.sceneTemplateId !== step.objectId) {
        const found = availableEntities.find(
          (o) => o.id === step.sceneTemplateId,
        );
        map.set(step.sceneTemplateId, {
          id: step.sceneTemplateId,
          kind: 'Scene',
          source: `Step: ${step.title}`,
          title: found?.title ?? 'Scene',
          type: 'scene',
        });
      }
      if (step.mapId && !map.has(step.mapId)) {
        map.set(step.mapId, {
          id: step.mapId,
          kind: 'Map',
          source: `Step: ${step.title}`,
          title: `Map: ${step.mapId}`,
          type: 'scene',
        });
      }
      if (step.referenceLabel && !step.objectId) {
        const key = `ref-${step.referenceLabel}`;
        if (!map.has(key)) {
          map.set(key, {
            id: key,
            kind: 'Mentioned entity',
            source: `Step: ${step.title}`,
            title: step.referenceLabel,
            type: 'npc',
          });
        }
      }
    }

    for (const dep of dependencies) {
      if (!map.has(dep.id)) {
        map.set(dep.id, {
          id: dep.id,
          kind: dep.kind,
          source: 'Dependency',
          title: dep.label,
          type:
            dep.kind === 'encounter'
              ? 'encounter'
              : dep.kind === 'scene'
                ? 'scene'
                : 'lore',
        });
      }
    }

    for (const att of attachments) {
      if (!map.has(att.id)) {
        map.set(att.id, {
          id: att.id,
          kind: att.subtitle || 'Attachment',
          source: 'Attachment',
          title: att.title,
          type: att.type,
        });
      }
    }

    return Array.from(map.values());
  }, [steps, availableEntities, dependencies, attachments]);

  const backlinks = useMemo<BacklinkItem[]>(() => {
    const list: BacklinkItem[] = [];
    list.push({
      id: 'campaign-root',
      kind: 'Campaign',
      title: model.campaignTitle,
    });
    if (model.breadcrumb) {
      list.push({
        id: 'session-nav',
        kind: 'Navigation',
        title: model.breadcrumb,
      });
    }
    for (const folder of model.folders) {
      list.push({
        id: folder.id,
        kind: 'Campaign Structure',
        title: folder.title,
      });
    }
    return list;
  }, [model.campaignTitle, model.breadcrumb, model.folders]);

  const effectiveSession: CampaignSession = useMemo(() => {
    if (session) return session;
    return {
      actId: 'act-1',
      campaignId: 'campaign-1',
      clueIds: [],
      encounterIds: [],
      factionIds: [],
      handoutIds: [],
      id: model.sessionId ?? 'session-1',
      locationIds: [],
      npcIds: [],
      number: 1,
      partyLevel: model.partyLevel,
      plannedDate: model.dateLabel,
      questIds: [],
      status: 'planned',
      summary: '',
      tags: model.tags,
      title: model.title,
    };
  }, [session, model]);

  const effectiveBundle: CampaignFixtureBundle = useMemo(() => {
    if (bundle) return bundle;
    const empty = createEmptyBundle({
      createdAt: new Date().toISOString(),
      description: model.campaignDescription ?? '',
      edition: '2024',
      id: 'campaign-1',
      name: model.campaignTitle,
      updatedAt: new Date().toISOString(),
    });
    return {
      ...empty,
      features: { publishSessionPlans: true },
      sessions: [effectiveSession],
    };
  }, [bundle, model, effectiveSession]);

  const effectiveContext: SectionContextValue = useMemo(() => {
    if (sectionContext) return sectionContext;
    return {
      basePath: model.backHref ? model.backHref.replace(/\/sessions$/, '') : '',
      bundle: effectiveBundle,
      store: createReadOnlyStore(effectiveBundle),
    };
  }, [sectionContext, effectiveBundle, model.backHref]);

  const completedChecks = checklist.filter((item) => item.complete).length;
  const publishDisabled =
    publishState === 'publishing' || (publishState === 'published' && !isDirty);
  const publishLabel =
    publishState === 'publishing'
      ? 'Publishing...'
      : publishState === 'published' && !isDirty
        ? 'Published'
        : persistedRevision !== undefined
          ? 'Publish changes'
          : 'Publish plan';

  function toggleFolder(folderId: string) {
    setExpandedFolders((current) => {
      const next = new Set(current);
      if (next.has(folderId)) next.delete(folderId);
      else next.add(folderId);
      return next;
    });
  }

  function moveStep(stepId: string, offset: -1 | 1) {
    const fromIndex = steps.findIndex((step) => step.id === stepId);
    const toIndex = fromIndex + offset;
    if (fromIndex < 0 || toIndex < 0 || toIndex >= steps.length) {
      return;
    }
    const next = [...steps];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    setSteps(next);
    onStepsChange?.(next);
    onDirty?.();
  }

  function addStep() {
    const reminder: SessionStepViewModel = {
      command: 'Reminder',
      durationMinutes: 5,
      id: `temporary-step-${steps.length + 1}`,
      title: 'Check in with the party before the final scene',
      track: 'main',
      visibility,
    };
    const next = [...steps, reminder];
    setSteps(next);
    setSelectedStepId(reminder.id);
    onStepsChange?.(next);
    onDirty?.();
  }

  function deleteStep(stepId: string) {
    const next = steps.filter((step) => step.id !== stepId);
    setSteps(next);
    if (selectedStepId === stepId) {
      setSelectedStepId(next[0]?.id ?? '');
    }
    onStepsChange?.(next);
    onDirty?.();
  }

  function setStepTrack(stepId: string, track: SessionStepViewModel['track']) {
    const next = steps.map((step) =>
      step.id === stepId ? { ...step, track } : step,
    );
    setSteps(next);
    onStepsChange?.(next);
    onDirty?.();
  }

  function editStep(stepId: string, patch: Partial<SessionStepViewModel>) {
    const next = steps.map((step) =>
      step.id === stepId ? { ...step, ...patch } : step,
    );
    setSteps(next);
    onStepsChange?.(next);
    onDirty?.();
  }

  function handleInsertObjectIntoPlan() {
    if (!selectedObject) return;
    const cmd: StepCommandType =
      selectedObject.type === 'encounter'
        ? 'deploy-encounter'
        : selectedObject.type === 'scene'
          ? 'open-scene'
          : selectedObject.type === 'handout'
            ? 'share-handout'
            : 'reveal-entry';

    const newStep: SessionStepViewModel = {
      body: `Reference: ${selectedObject.title}`,
      command: cmd,
      durationMinutes: 10,
      id: `inserted-step-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      objectId: selectedObject.id,
      referenceLabel: selectedObject.title,
      title: selectedObject.title,
      track: 'main',
      visibility,
      ...(selectedObject.type === 'encounter'
        ? { encounterId: selectedObject.id }
        : {}),
      ...(selectedObject.type === 'scene'
        ? { sceneTemplateId: selectedObject.id }
        : {}),
    };

    const next = [...steps, newStep];
    setSteps(next);
    setSelectedStepId(newStep.id);
    onStepsChange?.(next);
    onDirty?.();
  }

  function handleLinkObjectToActiveStep() {
    if (!selectedObject || !selectedStepId) return;
    const cmd: StepCommandType =
      selectedObject.type === 'encounter'
        ? 'deploy-encounter'
        : selectedObject.type === 'scene'
          ? 'open-scene'
          : selectedObject.type === 'handout'
            ? 'share-handout'
            : 'reveal-entry';

    const next = steps.map((step) => {
      if (step.id !== selectedStepId) return step;
      return {
        ...step,
        command: cmd,
        objectId: selectedObject.id,
        referenceLabel: selectedObject.title,
        ...(selectedObject.type === 'encounter'
          ? { encounterId: selectedObject.id }
          : {}),
        ...(selectedObject.type === 'scene'
          ? { sceneTemplateId: selectedObject.id }
          : {}),
      };
    });
    setSteps(next);
    onStepsChange?.(next);
    onDirty?.();
  }

  function handleEstimateAll() {
    const updatedSteps = steps.map((step) => {
      if (!step.durationMinutes || step.durationMinutes <= 0) {
        return { ...step, durationMinutes: 10 };
      }
      return step;
    });
    const sumMinutes = updatedSteps.reduce(
      (acc, step) => acc + (step.durationMinutes || 0),
      0,
    );
    setSteps(updatedSteps);
    onStepsChange?.(updatedSteps);
    onAuthoringChange?.({ estimatedMinutes: sumMinutes });
    onDirty?.();
  }

  function handleRemoveAttachment(id: string) {
    const next = attachments.filter((att) => att.id !== id);
    setAttachments(next);
    onAuthoringChange?.({ attachments: next.map((a) => a.id) });
    onDirty?.();
  }

  function handleAddAttachment(objectToAdd: LibraryObject) {
    if (attachments.some((a) => a.id === objectToAdd.id)) return;
    const next = [...attachments, objectToAdd];
    setAttachments(next);
    onAuthoringChange?.({ attachments: next.map((a) => a.id) });
    onDirty?.();
  }

  return (
    <div className={styles.layout}>
      <aside className={styles.library} aria-label="Campaign object library">
        <div className={styles.libraryHeader}>
          <div className={styles.searchWrap}>
            <Search aria-hidden="true" size={15} />
            <input
              aria-label="Search campaign objects"
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search objects"
              value={search}
            />
            <kbd>Ctrl K</kbd>
          </div>
          <div className={styles.segmented}>
            {(['campaign', 'compendium'] as const).map((tab) => (
              <button
                aria-pressed={libraryTab === tab}
                className={libraryTab === tab ? styles.activeSegment : ''}
                key={tab}
                onClick={() => setLibraryTab(tab)}
                type="button"
              >
                {tab === 'campaign' ? 'Campaign' : 'Compendium'}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.libraryScroll}>
          <section className={styles.typeList} aria-label="Object types">
            {model.counts.map((count) => {
              const isSelected =
                typeFilter === count.type && folderFilter === null;
              return (
                <button
                  aria-pressed={isSelected}
                  className={isSelected ? styles.activeTypeFilter : ''}
                  key={count.type}
                  onClick={() => {
                    setTypeFilter(count.type);
                    setFolderFilter(null);
                  }}
                  type="button"
                >
                  <span>{count.label}</span>
                  <span className={styles.count}>{count.count}</span>
                </button>
              );
            })}
          </section>

          {selectedObject && (
            <div
              aria-label={`Selected: ${selectedObject.title}`}
              className={styles.selectedObjectPanel}
            >
              <div className={styles.selectedObjectHeader}>
                <span className={styles.selectedObjectBadge}>
                  {selectedObject.type}
                </span>
                <span className={styles.selectedObjectTitle}>
                  {selectedObject.title}
                </span>
              </div>
              <div className={styles.selectedObjectActions}>
                <button
                  className={styles.objectActionButton}
                  onClick={handleInsertObjectIntoPlan}
                  type="button"
                >
                  <Plus size={13} /> Insert into Plan
                </button>
                <button
                  className={styles.objectActionButton}
                  disabled={!selectedStepId}
                  onClick={handleLinkObjectToActiveStep}
                  type="button"
                >
                  <Link2 size={13} /> Link to active step
                </button>
              </div>
            </div>
          )}

          <section className={styles.librarySection}>
            <div className={styles.sectionLabel}>Recent objects</div>
            {filteredObjects.map((item) => (
              <LibraryRow
                active={selectedObjectId === item.id}
                item={item}
                key={item.id}
                onSelect={() => setSelectedObjectId(item.id)}
              />
            ))}
            {filteredObjects.length === 0 && (
              <p className={styles.empty}>No objects match this search.</p>
            )}
          </section>

          {libraryTab === 'campaign' && (
            <section
              aria-label="Campaign structure"
              className={styles.librarySection}
            >
              <div className={styles.sectionLabel}>Campaign structure</div>
              {model.folders.map((folder) => {
                const expanded = expandedFolders.has(folder.id);
                return (
                  <div className={styles.folder} key={folder.id}>
                    <button
                      aria-expanded={expanded}
                      className={styles.folderRow}
                      onClick={() => toggleFolder(folder.id)}
                      type="button"
                    >
                      {expanded ? (
                        <ChevronDown size={15} />
                      ) : (
                        <ChevronRight size={15} />
                      )}
                      <span>
                        <strong>{folder.title}</strong>
                        <small>{folder.subtitle}</small>
                      </span>
                    </button>
                    {expanded && folder.childCounts && (
                      <div className={styles.folderChildren}>
                        {folder.childCounts.map((child) => {
                          const key = `${folder.id}::${child.label}`;
                          const isChildSelected = folderFilter === key;
                          return (
                            <button
                              aria-pressed={isChildSelected}
                              className={
                                isChildSelected ? styles.activeFolderChild : ''
                              }
                              key={child.label}
                              onClick={() => {
                                if (isChildSelected) {
                                  setFolderFilter(null);
                                } else {
                                  setFolderFilter(key);
                                  setTypeFilter('all');
                                }
                              }}
                              type="button"
                            >
                              <span>{child.label}</span>
                              <span>{child.count}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </section>
          )}
        </div>
      </aside>

      <main className={styles.workspace}>
        <header className={styles.sessionHeader}>
          <div className={styles.breadcrumb}>
            {model.backHref ? (
              <>
                <Link to={model.backHref}>Back to Sessions</Link>
                {' · '}
                {model.breadcrumb}
              </>
            ) : (
              model.breadcrumb
            )}
          </div>
          <div className={styles.titleLine}>
            <div>
              <h1>{model.title}</h1>
              <div className={styles.metadata}>
                <span>{model.dateLabel}</span>
                <span>{model.durationLabel}</span>
                <span>Party level {model.partyLevel}</span>
                {model.tags.map((tag) => (
                  <span className={styles.tag} key={tag}>
                    {tag}
                  </span>
                ))}
              </div>
            </div>
            <div className={styles.draftActions}>
              <button className={styles.draftButton} type="button">
                {publishState === 'published' && !isDirty
                  ? `Published (rev ${model.revision})`
                  : persistedRevision !== undefined
                    ? `Draft from rev ${persistedRevision}`
                    : 'Draft'}{' '}
                <ChevronDown size={14} />
              </button>
              <button
                aria-label="More session actions"
                className={styles.iconButton}
                title="More session actions"
                type="button"
              >
                <MoreHorizontal size={17} />
              </button>
            </div>
          </div>
          <div className={styles.tabBar}>
            {(
              [
                ['run-sheet', 'Run Sheet'],
                ['notes', 'Session Notes'],
                ['player-facing', 'Player Facing'],
                ['attachments', 'Attachments'],
              ] as Array<[WorkspaceTab, string]>
            ).map(([tab, label]) => (
              <button
                aria-selected={workspaceTab === tab}
                className={workspaceTab === tab ? styles.activeTab : ''}
                key={tab}
                onClick={() => setWorkspaceTab(tab)}
                role="tab"
                type="button"
              >
                {label}
              </button>
            ))}
          </div>
        </header>

        <div className={styles.commandBar}>
          {onSaveDraft && (
            <button
              className={styles.secondaryButton}
              disabled={isSaving || !isDirty}
              onClick={onSaveDraft}
              type="button"
            >
              {isSaving ? 'Saving draft…' : 'Save draft'}
            </button>
          )}
        </div>

        {workspaceTab === 'run-sheet' ? (
          <div className={styles.runSheet}>
            <div className={styles.commandBar}>
              <button
                className={styles.primaryButton}
                onClick={addStep}
                type="button"
              >
                <Plus size={15} /> Add Step
              </button>
              <button
                aria-pressed={reorderMode}
                className={
                  reorderMode ? styles.pressedButton : styles.secondaryButton
                }
                onClick={() => setReorderMode((current) => !current)}
                type="button"
              >
                <ListFilter size={15} /> Reorder
              </button>
              <button
                className={styles.secondaryButton}
                onClick={handleEstimateAll}
                type="button"
              >
                <Clock3 size={15} /> Estimate All
              </button>
              <button
                className={styles.secondaryButton}
                onClick={() => setIsPreviewOpen(true)}
                type="button"
              >
                <Eye size={15} /> Preview
              </button>
            </div>

            <div className={styles.steps}>
              {/* ── MAIN TIMELINE ─────────────────────────────────────────── */}
              {steps
                .filter((s) => s.track === 'main')
                .map((step, index) => {
                  const selected = step.id === selectedStepId;
                  return (
                    <StepRow
                      availableEntities={availableEntities}
                      index={index}
                      isSelected={selected}
                      key={step.id}
                      onDelete={() => deleteStep(step.id)}
                      onEdit={(patch) => editStep(step.id, patch)}
                      onMoveDown={() => moveStep(step.id, 1)}
                      onMoveUp={() => moveStep(step.id, -1)}
                      onSelect={() => setSelectedStepId(step.id)}
                      onTrackChange={(track) => setStepTrack(step.id, track)}
                      reorderMode={reorderMode}
                      step={step}
                      totalMainSteps={
                        steps.filter((s) => s.track === 'main').length
                      }
                    />
                  );
                })}

              {/* ── PARALLEL THREADS ──────────────────────────────────────── */}
              {steps.some((s) => s.track === 'parallel') && (
                <>
                  <div className={styles.trackDivider}>
                    <span>Parallel Threads</span>
                    <small>
                      Always available — not gated by timeline progress
                    </small>
                  </div>
                  {steps
                    .filter((s) => s.track === 'parallel')
                    .map((step, index) => {
                      const selected = step.id === selectedStepId;
                      return (
                        <StepRow
                          availableEntities={availableEntities}
                          index={index}
                          isParallel
                          isSelected={selected}
                          key={step.id}
                          onDelete={() => deleteStep(step.id)}
                          onEdit={(patch) => editStep(step.id, patch)}
                          onMoveDown={() => moveStep(step.id, 1)}
                          onMoveUp={() => moveStep(step.id, -1)}
                          onSelect={() => setSelectedStepId(step.id)}
                          onTrackChange={(track) =>
                            setStepTrack(step.id, track)
                          }
                          reorderMode={reorderMode}
                          step={step}
                          totalMainSteps={
                            steps.filter((s) => s.track === 'parallel').length
                          }
                        />
                      );
                    })}
                </>
              )}
            </div>
          </div>
        ) : (
          <WorkspacePlaceholder
            attachments={attachments}
            availableObjects={availableEntities}
            body={
              workspaceTab === 'notes'
                ? notes
                : workspaceTab === 'player-facing'
                  ? playerFacing
                  : undefined
            }
            onAddAttachment={handleAddAttachment}
            onChange={
              workspaceTab === 'notes'
                ? (value) => {
                    setNotes(value);
                    onAuthoringChange?.({ notes: value.split('\n') });
                    onDirty?.();
                  }
                : workspaceTab === 'player-facing'
                  ? (value) => {
                      setPlayerFacing(value);
                      onAuthoringChange?.({ playerFacingSummary: value });
                      onDirty?.();
                    }
                  : undefined
            }
            onRemoveAttachment={handleRemoveAttachment}
            tab={workspaceTab}
          />
        )}

        <div
          aria-label="Session actions"
          className={styles.mobileActionBar}
          role="region"
        >
          {publishMessage && (
            <p
              className={`${styles.mobilePublishMessage} ${
                publishState === 'error' ? styles.publishError : ''
              }`}
              role="status"
            >
              {publishMessage}
            </p>
          )}
          <div className={styles.mobileActionsGroup}>
            <button
              className={styles.mobilePublishButton}
              disabled={publishDisabled}
              onClick={() =>
                onPublish
                  ? onPublish(steps)
                  : onCapability('session-plan.publish')
              }
              type="button"
            >
              <Send size={15} />
              {publishLabel}
            </button>
            {publishState === 'published' && !isDirty && (
              <button
                className={styles.mobileDraftButton}
                onClick={onBeginDraft}
                type="button"
              >
                <FilePenLine size={15} /> Create draft
              </button>
            )}
            {(publishState === 'published' ||
              persistedRevision !== undefined) && (
              <button
                className={styles.mobileActivateButton}
                disabled={
                  activateState === 'activating' ||
                  isDirty ||
                  isSaving ||
                  publishState !== 'published'
                }
                onClick={() =>
                  onActivate
                    ? onActivate(steps)
                    : onCapability('session-plan.activate')
                }
                type="button"
              >
                {activateState === 'activated' ? (
                  <RotateCcw size={15} />
                ) : (
                  <Play size={15} />
                )}
                {activateState === 'activating'
                  ? 'Activating in VTT...'
                  : activateState === 'activated'
                    ? 'Restart run in VTT'
                    : 'Play in VTT'}
              </button>
            )}
          </div>
        </div>
      </main>

      <aside className={styles.inspector} aria-label="Session details">
        <div className={styles.inspectorTabs}>
          {(
            [
              ['details', 'Details'],
              ['references', 'References'],
              ['chat-prep', 'Chat Prep'],
            ] as Array<[InspectorTab, string]>
          ).map(([tab, label]) => (
            <button
              aria-selected={inspectorTab === tab}
              className={inspectorTab === tab ? styles.activeTab : ''}
              key={tab}
              onClick={() => {
                setInspectorTab(tab);
                if (tab === 'chat-prep') onCapability('session-plan.chat-prep');
              }}
              role="tab"
              type="button"
            >
              {label}
              {tab === 'chat-prep' && (
                <span className={styles.betaBadge}>Experimental</span>
              )}
            </button>
          ))}
        </div>

        <div className={styles.inspectorScroll}>
          <div className={styles.inspectorHeading}>
            <span className={styles.eyebrow}>Session Plan</span>
            <h2>Revision {model.revision}</h2>
            <p>{model.lastEditedLabel}</p>
            <button
              className={styles.textButton}
              onClick={() => setIsHistoryOpen(true)}
              type="button"
            >
              View history
            </button>
          </div>

          {inspectorTab === 'references' ? (
            <div
              aria-label="References inspector"
              className={styles.referencesPane}
              role="region"
            >
              <InspectorSection
                title={`Referenced Entities (${referencedEntities.length})`}
              >
                {referencedEntities.length === 0 ? (
                  <p className={styles.empty}>
                    No entities referenced in this plan.
                  </p>
                ) : (
                  <div className={styles.referencesList}>
                    {referencedEntities.map((entity) => {
                      const Icon = TYPE_ICONS[entity.type] ?? FileText;
                      return (
                        <div className={styles.referenceItem} key={entity.id}>
                          <span className={styles.referenceIcon}>
                            <Icon size={14} />
                          </span>
                          <div className={styles.referenceDetails}>
                            <strong>{entity.title}</strong>
                            <small>
                              {entity.kind} · {entity.source}
                            </small>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </InspectorSection>

              <InspectorSection title={`Backlinks (${backlinks.length})`}>
                <div className={styles.backlinksList}>
                  {backlinks.map((link) => (
                    <div className={styles.backlinkItem} key={link.id}>
                      <strong>{link.title}</strong>
                      <small>{link.kind}</small>
                    </div>
                  ))}
                </div>
              </InspectorSection>
            </div>
          ) : inspectorTab === 'chat-prep' ? (
            <div
              aria-label="Chat prep experimental tab"
              className={styles.chatPrepPane}
            >
              <div className={styles.experimentalBadge}>
                <Sparkles size={14} /> Experimental Feature
              </div>
              <h3>AI Chat Preparation</h3>
              <p>
                Conversational session prep with the Codex AI assistant is
                currently experimental. You can brainstorm encounters, develop
                NPC personas, and refine narrative pacing.
              </p>
              <button
                className={styles.secondaryButton}
                onClick={() => onCapability('session-plan.chat-prep')}
                type="button"
              >
                Launch Chat Prep Assistant
              </button>
            </div>
          ) : (
            <>
              <InspectorSection title="Dependencies">
                {dependencies.map((dependency) => (
                  <div className={styles.checkRow} key={dependency.id}>
                    <span
                      className={
                        dependency.ready ? styles.checkOn : styles.checkOff
                      }
                    >
                      {dependency.ready && <Check size={12} />}
                    </span>
                    <span>
                      <strong>{dependency.label}</strong>
                      <small>{dependency.kind}</small>
                    </span>
                  </div>
                ))}
              </InspectorSection>

              <InspectorSection
                title={`Readiness ${completedChecks}/${checklist.length}`}
              >
                <div className={styles.progressTrack}>
                  <span
                    style={{
                      width: `${(completedChecks / checklist.length) * 100}%`,
                    }}
                  />
                </div>
                {checklist.map((item) => (
                  <label className={styles.checklistRow} key={item.id}>
                    <input
                      checked={item.complete}
                      onChange={() => {
                        const next = checklist.map((check) =>
                          check.id === item.id
                            ? { ...check, complete: !check.complete }
                            : check,
                        );
                        setChecklist(next);
                        onAuthoringChange?.({ readiness: next });
                        onDirty?.();
                      }}
                      type="checkbox"
                    />
                    {item.label}
                  </label>
                ))}
              </InspectorSection>

              <InspectorSection title="Default visibility for new steps">
                <label className={styles.radioRow}>
                  <input
                    checked={visibility === 'dm-only'}
                    onChange={() => {
                      setVisibility('dm-only');
                      onAuthoringChange?.({ defaultVisibility: 'dm-only' });
                      onDirty?.();
                    }}
                    type="radio"
                  />
                  <span>
                    <strong>DM only</strong>
                    <small>Keep planning details private</small>
                  </span>
                </label>
                <label className={styles.radioRow}>
                  <input
                    checked={visibility === 'shared'}
                    onChange={() => {
                      setVisibility('shared');
                      onAuthoringChange?.({ defaultVisibility: 'shared' });
                      onDirty?.();
                    }}
                    type="radio"
                  />
                  <span>
                    <strong>Shared with players</strong>
                    <small>Expose player-facing sections</small>
                  </span>
                </label>
              </InspectorSection>
            </>
          )}
        </div>

        <div className={styles.publishArea}>
          {publishMessage && (
            <p
              className={`${styles.publishMessage} ${publishState === 'error' ? styles.publishError : ''}`}
              role="status"
            >
              {publishMessage}
            </p>
          )}
          <button
            className={styles.publishButton}
            disabled={publishDisabled}
            onClick={() =>
              onPublish
                ? onPublish(steps)
                : onCapability('session-plan.publish')
            }
            type="button"
          >
            <Send size={15} />
            {publishLabel}
          </button>
          {publishState === 'published' && !isDirty && (
            <button
              className={styles.draftActionButton}
              onClick={onBeginDraft}
              type="button"
            >
              <FilePenLine size={15} /> Create draft
            </button>
          )}
          {(publishState === 'published' ||
            persistedRevision !== undefined) && (
            <button
              className={styles.activateButton}
              disabled={
                activateState === 'activating' ||
                isDirty ||
                isSaving ||
                publishState !== 'published'
              }
              onClick={() =>
                onActivate
                  ? onActivate(steps)
                  : onCapability('session-plan.activate')
              }
              type="button"
            >
              {activateState === 'activated' ? (
                <RotateCcw size={15} />
              ) : (
                <Play size={15} />
              )}
              {activateState === 'activating'
                ? 'Activating in VTT...'
                : activateState === 'activated'
                  ? 'Restart run in VTT'
                  : 'Play in VTT'}
            </button>
          )}
        </div>
      </aside>

      {isPreviewOpen && (
        <RunSheetExportModal
          bundle={effectiveBundle}
          isOpen={isPreviewOpen}
          onClose={() => setIsPreviewOpen(false)}
          session={effectiveSession}
        />
      )}

      {isHistoryOpen && (
        <SectionContext.Provider value={effectiveContext}>
          <RevisionHistoryModal
            currentDraft={
              model.authoring
                ? (model.authoring as unknown as Record<string, unknown>)
                : {
                    checklist,
                    notes,
                    playerFacing,
                    steps,
                  }
            }
            isOpen={isHistoryOpen}
            kind="session"
            objectId={model.planId ?? model.sessionId ?? 'session-plan-1'}
            onClose={() => setIsHistoryOpen(false)}
            title={model.title}
          />
        </SectionContext.Provider>
      )}
    </div>
  );
}

interface LibraryRowProps {
  active: boolean;
  item: LibraryObject;
  onSelect: () => void;
}

function LibraryRow({ active, item, onSelect }: LibraryRowProps) {
  const Icon = TYPE_ICONS[item.type];
  return (
    <button
      className={`${styles.objectRow} ${active ? styles.activeObject : ''}`}
      onClick={onSelect}
      type="button"
    >
      <span className={styles.objectIcon}>
        <Icon size={15} />
      </span>
      <span>
        <strong>{item.title}</strong>
        <small>{item.subtitle}</small>
      </span>
    </button>
  );
}

interface InspectorSectionProps {
  children: React.ReactNode;
  title: string;
}

function InspectorSection({ children, title }: InspectorSectionProps) {
  return (
    <section className={styles.inspectorSection}>
      <h3>{title}</h3>
      {children}
    </section>
  );
}

interface WorkspacePlaceholderProps {
  attachments: LibraryObject[];
  availableObjects?: LibraryObject[];
  body?: string;
  onAddAttachment?: (objectToAdd: LibraryObject) => void;
  onChange?: (value: string) => void;
  onRemoveAttachment?: (id: string) => void;
  tab: Exclude<WorkspaceTab, 'run-sheet'>;
}

function WorkspacePlaceholder({
  attachments,
  availableObjects = [],
  body,
  onAddAttachment,
  onChange,
  onRemoveAttachment,
  tab,
}: WorkspacePlaceholderProps) {
  const [selectedAttachmentId, setSelectedAttachmentId] = useState('');
  const title =
    tab === 'notes'
      ? 'Session Notes'
      : tab === 'player-facing'
        ? 'Player Facing'
        : 'Attachments';

  const unattachedObjects = useMemo(() => {
    return availableObjects.filter(
      (obj) => !attachments.some((att) => att.id === obj.id),
    );
  }, [availableObjects, attachments]);

  return (
    <div className={styles.placeholder}>
      <div className={styles.placeholderIcon}>
        {tab === 'attachments' ? (
          <FileText size={20} />
        ) : (
          <MessageSquareText size={20} />
        )}
      </div>
      <h2>{title}</h2>
      {onChange ? (
        <label>
          {title}
          <textarea
            aria-label={title}
            onChange={(event) => onChange(event.target.value)}
            value={body ?? ''}
          />
        </label>
      ) : (
        body && <p>{body}</p>
      )}
      {tab === 'attachments' && (
        <div className={styles.attachmentsWorkspace}>
          <div className={styles.attachmentsList}>
            {attachments.length === 0 ? (
              <p className={styles.empty}>
                No attachments in this session plan yet.
              </p>
            ) : (
              attachments.map((item) => {
                const Icon = TYPE_ICONS[item.type] ?? FileText;
                return (
                  <div className={styles.attachment} key={item.id}>
                    <Icon size={15} />
                    <span className={styles.attachmentDetails}>
                      <strong>{item.title}</strong>
                      <small>{item.subtitle}</small>
                    </span>
                    {onRemoveAttachment && (
                      <button
                        aria-label={`Remove attachment ${item.title}`}
                        className={styles.removeAttachmentButton}
                        onClick={() => onRemoveAttachment(item.id)}
                        title="Remove attachment"
                        type="button"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>
          {onAddAttachment && unattachedObjects.length > 0 && (
            <div className={styles.addAttachmentControls}>
              <h3>Add Attachment</h3>
              <div className={styles.addAttachmentRow}>
                <select
                  aria-label="Select object to attach"
                  className={styles.fieldSelect}
                  onChange={(e) => setSelectedAttachmentId(e.target.value)}
                  value={selectedAttachmentId}
                >
                  <option value="">Choose an object to attach...</option>
                  {unattachedObjects.map((obj) => (
                    <option key={obj.id} value={obj.id}>
                      {obj.title} ({obj.type})
                    </option>
                  ))}
                </select>
                <button
                  className={styles.secondaryButton}
                  disabled={!selectedAttachmentId}
                  onClick={() => {
                    const obj = unattachedObjects.find(
                      (o) => o.id === selectedAttachmentId,
                    );
                    if (obj) {
                      onAddAttachment(obj);
                      setSelectedAttachmentId('');
                    }
                  }}
                  type="button"
                >
                  <Plus size={14} /> Attach
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface StepRowProps {
  availableEntities?: LibraryObject[];
  index: number;
  isParallel?: boolean;
  isSelected: boolean;
  onDelete?: () => void;
  onEdit?: (patch: Partial<SessionStepViewModel>) => void;
  onMoveDown: () => void;
  onMoveUp: () => void;
  onSelect: () => void;
  onTrackChange: (track: SessionStepViewModel['track']) => void;
  reorderMode: boolean;
  step: SessionStepViewModel;
  totalMainSteps: number;
}

function StepRow({
  availableEntities,
  index,
  isParallel = false,
  isSelected,
  onDelete,
  onEdit,
  onMoveDown,
  onMoveUp,
  onSelect,
  onTrackChange,
  reorderMode,
  step,
  totalMainSteps,
}: StepRowProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const cmdValue = toCommandSelectValue(step.command);

  const availableEntitiesForCmd = useMemo(() => {
    if (!availableEntities) return [];
    switch (cmdValue) {
      case 'deploy-encounter': {
        const filtered = availableEntities.filter(
          (e) => e.type === 'encounter',
        );
        return filtered.length > 0 ? filtered : availableEntities;
      }
      case 'open-scene': {
        const filtered = availableEntities.filter((e) => e.type === 'scene');
        return filtered.length > 0 ? filtered : availableEntities;
      }
      case 'share-handout': {
        const filtered = availableEntities.filter((e) => e.type === 'handout');
        return filtered.length > 0 ? filtered : availableEntities;
      }
      case 'reveal-entry': {
        const filtered = availableEntities.filter(
          (e) => e.type === 'lore' || e.type === 'npc',
        );
        return filtered.length > 0 ? filtered : availableEntities;
      }
      default:
        return availableEntities;
    }
  }, [availableEntities, cmdValue]);

  function handleFormat(wrapper: string) {
    const textarea = textareaRef.current;
    if (!textarea || !onEdit) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const val = step.body ?? '';
    const selectedText = val.substring(start, end);
    const replacement = selectedText
      ? `${wrapper}${selectedText}${wrapper}`
      : `${wrapper}text${wrapper}`;
    const nextVal = val.substring(0, start) + replacement + val.substring(end);
    onEdit({ body: nextVal });
    setTimeout(() => {
      textarea.focus();
      const selStart = start + wrapper.length;
      const selEnd = selStart + (selectedText ? selectedText.length : 4);
      textarea.setSelectionRange(selStart, selEnd);
    }, 0);
  }

  function handleInsertReference() {
    const textarea = textareaRef.current;
    if (!textarea || !onEdit) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const val = step.body ?? '';
    const selectedText = val.substring(start, end);
    const replacement = selectedText ? `@[${selectedText}]` : '@[';
    const nextVal = val.substring(0, start) + replacement + val.substring(end);
    onEdit({ body: nextVal });
    setTimeout(() => {
      textarea.focus();
      const newPos = start + replacement.length;
      textarea.setSelectionRange(newPos, newPos);
    }, 0);
  }

  return (
    <article
      className={`${styles.step} ${isSelected ? styles.selectedStep : ''} ${isParallel ? styles.parallelStep : ''}`}
    >
      <button
        aria-label={`Select ${step.title}`}
        className={styles.stepSelect}
        onClick={onSelect}
        type="button"
      >
        <GripVertical className={styles.grip} size={16} />
        <span className={styles.stepNumber}>
          {String(index + 1).padStart(2, '0')}
        </span>
        <span className={styles.stepText}>
          <small>
            {step.command}
            {isParallel && (
              <span className={styles.parallelBadge}>Parallel</span>
            )}
          </small>
          <strong>{step.title}</strong>
        </span>
        <span className={styles.stepMeta}>
          {step.durationMinutes > 0 && <span>{step.durationMinutes} min</span>}
          <span>{step.visibility === 'shared' ? 'Shared' : 'DM only'}</span>
        </span>
      </button>

      {reorderMode && (
        <div className={styles.reorderControls}>
          <button disabled={index === 0} onClick={onMoveUp} type="button">
            Up
          </button>
          <button
            disabled={index === totalMainSteps - 1}
            onClick={onMoveDown}
            type="button"
          >
            Down
          </button>
        </div>
      )}

      {isSelected && (
        <div className={styles.editor}>
          <div className={styles.trackControl}>
            <span>Track</span>
            <div aria-label={`Track for ${step.title}`} role="group">
              <button
                aria-pressed={step.track === 'main'}
                onClick={() => onTrackChange('main')}
                type="button"
              >
                Main timeline
              </button>
              <button
                aria-pressed={step.track === 'parallel'}
                onClick={() => onTrackChange('parallel')}
                type="button"
              >
                Parallel
              </button>
            </div>
          </div>

          {onEdit && (
            <>
              <label className={styles.editorField}>
                Step title
                <input
                  aria-label={`Title for ${step.title}`}
                  className={styles.fieldInput}
                  onChange={(event) => onEdit({ title: event.target.value })}
                  placeholder="Step title"
                  type="text"
                  value={step.title}
                />
              </label>

              <label className={styles.editorField}>
                Duration (minutes)
                <div className={styles.durationInputGroup}>
                  <input
                    aria-label={`Duration for ${step.title}`}
                    className={styles.fieldInput}
                    max={480}
                    min={0}
                    onChange={(event) =>
                      onEdit({
                        durationMinutes: Math.max(
                          0,
                          parseInt(event.target.value, 10) || 0,
                        ),
                      })
                    }
                    type="number"
                    value={step.durationMinutes}
                  />
                  <div className={styles.quickDurationButtons}>
                    <button
                      onClick={() =>
                        onEdit({
                          durationMinutes: (step.durationMinutes || 0) + 5,
                        })
                      }
                      type="button"
                    >
                      +5m
                    </button>
                    <button
                      onClick={() =>
                        onEdit({
                          durationMinutes: (step.durationMinutes || 0) + 15,
                        })
                      }
                      type="button"
                    >
                      +15m
                    </button>
                  </div>
                </div>
              </label>

              <label className={styles.editorField}>
                Command type
                <select
                  aria-label={`Command for ${step.title}`}
                  className={styles.fieldSelect}
                  onChange={(event) => {
                    const nextCmd = event.target.value as StepCommandType;
                    onEdit({
                      command: nextCmd,
                    });
                  }}
                  value={cmdValue}
                >
                  <option value="reminder">Reminder</option>
                  <option value="open-scene">Activate scene</option>
                  <option value="deploy-encounter">Deploy encounter</option>
                  <option value="share-handout">Share handout</option>
                  <option value="reveal-entry">Reveal entry</option>
                </select>
              </label>

              {cmdValue !== 'reminder' && (
                <label className={styles.editorField}>
                  Target object
                  <select
                    aria-label={`Target entity for ${step.title}`}
                    className={styles.fieldSelect}
                    onChange={(event) => {
                      const selectedId = event.target.value;
                      if (!selectedId) {
                        onEdit({
                          encounterId: undefined,
                          objectId: undefined,
                          referenceLabel: undefined,
                          sceneTemplateId: undefined,
                        });
                        return;
                      }
                      const targetEntity = availableEntities?.find(
                        (e) => e.id === selectedId,
                      );
                      onEdit({
                        ...(cmdValue === 'deploy-encounter'
                          ? { encounterId: selectedId }
                          : {}),
                        ...(cmdValue === 'open-scene'
                          ? { sceneTemplateId: selectedId }
                          : {}),
                        objectId: selectedId,
                        referenceLabel: targetEntity?.title,
                      });
                    }}
                    value={
                      step.objectId ||
                      step.encounterId ||
                      step.sceneTemplateId ||
                      ''
                    }
                  >
                    <option value="">None / Unlinked</option>
                    {availableEntitiesForCmd.map((entity) => (
                      <option key={entity.id} value={entity.id}>
                        {entity.title} ({entity.type})
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <label className={styles.editorField}>
                Step visibility
                <select
                  aria-label={`Visibility for ${step.title}`}
                  className={styles.fieldSelect}
                  onChange={(event) =>
                    onEdit({
                      visibility: event.target
                        .value as SessionStepViewModel['visibility'],
                    })
                  }
                  value={step.visibility}
                >
                  <option value="dm-only">DM only</option>
                  <option value="shared">Shared with players</option>
                </select>
              </label>
            </>
          )}

          {(step.body !== undefined || onEdit) && (
            <>
              <div className={styles.editorToolbar}>
                <button
                  aria-label="Bold"
                  onClick={() => handleFormat('**')}
                  title="Bold formatting (**bold**)"
                  type="button"
                >
                  <strong>B</strong>
                </button>
                <button
                  aria-label="Italic"
                  onClick={() => handleFormat('*')}
                  title="Italic formatting (*italic*)"
                  type="button"
                >
                  <em>I</em>
                </button>
                <span />
                <button
                  aria-label="Insert reference"
                  onClick={handleInsertReference}
                  title="Insert @ reference"
                  type="button"
                >
                  @ Reference
                </button>
              </div>
              <textarea
                aria-label="Session step notes"
                className={styles.editorBody}
                onChange={(event) => onEdit?.({ body: event.target.value })}
                readOnly={!onEdit}
                ref={textareaRef}
                value={step.body ?? ''}
              />
            </>
          )}

          {onDelete && (
            <div className={styles.stepRowActions}>
              <button
                aria-label={`Delete ${step.title}`}
                className={styles.deleteStepButton}
                onClick={onDelete}
                type="button"
              >
                <Trash2 size={13} /> Delete step
              </button>
            </div>
          )}
        </div>
      )}
    </article>
  );
}
