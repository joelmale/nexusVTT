import BookOpen from 'lucide-react/dist/esm/icons/book-open';
import Check from 'lucide-react/dist/esm/icons/check';
import ChevronDown from 'lucide-react/dist/esm/icons/chevron-down';
import ChevronRight from 'lucide-react/dist/esm/icons/chevron-right';
import Clock3 from 'lucide-react/dist/esm/icons/clock-3';
import Eye from 'lucide-react/dist/esm/icons/eye';
import FileText from 'lucide-react/dist/esm/icons/file-text';
import GripVertical from 'lucide-react/dist/esm/icons/grip-vertical';
import ListFilter from 'lucide-react/dist/esm/icons/list-filter';
import MessageSquareText from 'lucide-react/dist/esm/icons/message-square-text';
import MoreHorizontal from 'lucide-react/dist/esm/icons/more-horizontal';
import Play from 'lucide-react/dist/esm/icons/play';
import Plus from 'lucide-react/dist/esm/icons/plus';
import Search from 'lucide-react/dist/esm/icons/search';
import Send from 'lucide-react/dist/esm/icons/send';
import Sparkles from 'lucide-react/dist/esm/icons/sparkles';
import Swords from 'lucide-react/dist/esm/icons/swords';
import UserRound from 'lucide-react/dist/esm/icons/user-round';
import { useMemo, useState } from 'react';

import type { CapabilityId } from '@/features/capability-notice';

import type {
  LibraryObject,
  LibraryObjectType,
  SessionPlanViewModel,
  SessionStepViewModel,
} from './sessionPlanModels';
import styles from './SessionPlan.module.css';

interface SessionPlanProps {
  model: SessionPlanViewModel;
  onCapability: (capabilityId: CapabilityId) => void;
  onPublish?: () => void;
  onActivate?: () => void;
  publishMessage?: string;
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

export function SessionPlan({
  model,
  onCapability,
  onPublish,
  onActivate,
  publishMessage,
  publishState = 'idle',
  activateState = 'idle',
}: SessionPlanProps) {
  const [libraryTab, setLibraryTab] = useState<'campaign' | 'compendium'>(
    'campaign',
  );
  const [workspaceTab, setWorkspaceTab] = useState<WorkspaceTab>('run-sheet');
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>('details');
  const [search, setSearch] = useState('');
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
  const [dependencies, setDependencies] = useState(model.dependencies);
  const [checklist, setChecklist] = useState(model.checklist);
  const [visibility, setVisibility] = useState<'dm-only' | 'shared'>('dm-only');

  const libraryObjects =
    libraryTab === 'campaign' ? model.recentObjects : model.compendiumObjects;
  const filteredObjects = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return libraryObjects;
    return libraryObjects.filter((item) =>
      `${item.title} ${item.subtitle} ${item.type}`
        .toLowerCase()
        .includes(query),
    );
  }, [libraryObjects, search]);

  const completedChecks = checklist.filter((item) => item.complete).length;

  function toggleFolder(folderId: string) {
    setExpandedFolders((current) => {
      const next = new Set(current);
      if (next.has(folderId)) next.delete(folderId);
      else next.add(folderId);
      return next;
    });
  }

  function moveStep(stepId: string, offset: -1 | 1) {
    setSteps((current) => {
      const fromIndex = current.findIndex((step) => step.id === stepId);
      const toIndex = fromIndex + offset;
      if (fromIndex < 0 || toIndex < 0 || toIndex >= current.length) {
        return current;
      }
      const next = [...current];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  }

  function addStep() {
    const reminder: SessionStepViewModel = {
      command: 'Reminder',
      durationMinutes: 5,
      id: `temporary-step-${steps.length + 1}`,
      title: 'Check in with the party before the final scene',
      visibility: 'dm-only',
    };
    setSteps((current) => [...current, reminder]);
    setSelectedStepId(reminder.id);
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
            {model.counts.map((count) => (
              <button key={count.type} type="button">
                <span>{count.label}</span>
                <span className={styles.count}>{count.count}</span>
              </button>
            ))}
          </section>

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
            <section className={styles.librarySection}>
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
                        {folder.childCounts.map((child) => (
                          <button key={child.label} type="button">
                            <span>{child.label}</span>
                            <span>{child.count}</span>
                          </button>
                        ))}
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
          <div className={styles.breadcrumb}>{model.breadcrumb}</div>
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
                Draft <ChevronDown size={14} />
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
                onClick={() => onCapability('session-plan.preview')}
                type="button"
              >
                <Clock3 size={15} /> Estimate All
              </button>
              <button
                className={styles.secondaryButton}
                onClick={() => onCapability('session-plan.preview')}
                type="button"
              >
                <Eye size={15} /> Preview
              </button>
            </div>

            <div className={styles.steps}>
              {steps.map((step, index) => {
                const selected = step.id === selectedStepId;
                return (
                  <article
                    className={`${styles.step} ${selected ? styles.selectedStep : ''}`}
                    key={step.id}
                  >
                    <button
                      aria-label={`Select ${step.title}`}
                      className={styles.stepSelect}
                      onClick={() => setSelectedStepId(step.id)}
                      type="button"
                    >
                      <GripVertical className={styles.grip} size={16} />
                      <span className={styles.stepNumber}>
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      <span className={styles.stepText}>
                        <small>{step.command}</small>
                        <strong>{step.title}</strong>
                      </span>
                      <span className={styles.stepMeta}>
                        <span>{step.durationMinutes} min</span>
                        <span>
                          {step.visibility === 'shared' ? 'Shared' : 'DM only'}
                        </span>
                      </span>
                    </button>
                    {reorderMode && (
                      <div className={styles.reorderControls}>
                        <button
                          disabled={index === 0}
                          onClick={() => moveStep(step.id, -1)}
                          type="button"
                        >
                          Up
                        </button>
                        <button
                          disabled={index === steps.length - 1}
                          onClick={() => moveStep(step.id, 1)}
                          type="button"
                        >
                          Down
                        </button>
                      </div>
                    )}
                    {selected && step.body && (
                      <div className={styles.editor}>
                        <div className={styles.editorToolbar}>
                          <button aria-label="Bold" title="Bold" type="button">
                            <strong>B</strong>
                          </button>
                          <button
                            aria-label="Italic"
                            title="Italic"
                            type="button"
                          >
                            <em>I</em>
                          </button>
                          <span />
                          <button
                            onClick={() => onCapability('campaign.search')}
                            type="button"
                          >
                            @ Reference
                          </button>
                        </div>
                        <div
                          aria-label="Session step notes"
                          className={styles.editorBody}
                          contentEditable
                          suppressContentEditableWarning
                        >
                          {step.body}{' '}
                          {step.referenceLabel && (
                            <span className={styles.reference}>
                              @{step.referenceLabel}
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          </div>
        ) : (
          <WorkspacePlaceholder
            attachments={model.attachments}
            body={
              workspaceTab === 'notes'
                ? model.notes
                : workspaceTab === 'player-facing'
                  ? model.playerFacing
                  : undefined
            }
            tab={workspaceTab}
          />
        )}
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
              onClick={() => onCapability('campaign.object.history')}
              type="button"
            >
              View history
            </button>
          </div>

          <InspectorSection title="Dependencies">
            {dependencies.map((dependency) => (
              <button
                className={styles.checkRow}
                key={dependency.id}
                onClick={() =>
                  setDependencies((current) =>
                    current.map((item) =>
                      item.id === dependency.id
                        ? { ...item, ready: !item.ready }
                        : item,
                    ),
                  )
                }
                type="button"
              >
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
              </button>
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
                  onChange={() =>
                    setChecklist((current) =>
                      current.map((check) =>
                        check.id === item.id
                          ? { ...check, complete: !check.complete }
                          : check,
                      ),
                    )
                  }
                  type="checkbox"
                />
                {item.label}
              </label>
            ))}
          </InspectorSection>

          <InspectorSection title="Plan visibility">
            <label className={styles.radioRow}>
              <input
                checked={visibility === 'dm-only'}
                onChange={() => setVisibility('dm-only')}
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
                onChange={() => setVisibility('shared')}
                type="radio"
              />
              <span>
                <strong>Shared with players</strong>
                <small>Expose player-facing sections</small>
              </span>
            </label>
          </InspectorSection>
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
            disabled={publishState === 'publishing'}
            onClick={onPublish ?? (() => onCapability('session-plan.publish'))}
            type="button"
          >
            <Send size={15} />
            {publishState === 'publishing'
              ? 'Publishing...'
              : publishState === 'published'
                ? 'Published'
                : 'Publish plan'}
          </button>
          {publishState === 'published' && (
            <button
              className={styles.activateButton}
              disabled={activateState === 'activating'}
              onClick={
                onActivate ?? (() => onCapability('session-plan.activate'))
              }
              type="button"
            >
              <Play size={15} />
              {activateState === 'activating'
                ? 'Activating in VTT...'
                : activateState === 'activated'
                  ? 'Activated in VTT'
                  : 'Play in VTT'}
            </button>
          )}
        </div>
      </aside>
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
  body?: string;
  tab: Exclude<WorkspaceTab, 'run-sheet'>;
}

function WorkspacePlaceholder({
  attachments,
  body,
  tab,
}: WorkspacePlaceholderProps) {
  const title =
    tab === 'notes'
      ? 'Session Notes'
      : tab === 'player-facing'
        ? 'Player Facing'
        : 'Attachments';
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
      {body && <p>{body}</p>}
      {tab === 'attachments' &&
        attachments.map((item) => (
          <div className={styles.attachment} key={item.id}>
            <FileText size={15} />
            <span>
              <strong>{item.title}</strong>
              <small>{item.subtitle}</small>
            </span>
          </div>
        ))}
    </div>
  );
}
