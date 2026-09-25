import { useState } from 'react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import ArrowRight from 'lucide-react/dist/esm/icons/arrow-right';
import BookOpen from 'lucide-react/dist/esm/icons/book-open';
import CalendarDays from 'lucide-react/dist/esm/icons/calendar-days';
import CheckSquare from 'lucide-react/dist/esm/icons/check-square';
import ChevronDown from 'lucide-react/dist/esm/icons/chevron-down';
import ChevronRight from 'lucide-react/dist/esm/icons/chevron-right';
import Compass from 'lucide-react/dist/esm/icons/compass';
import FileText from 'lucide-react/dist/esm/icons/file-text';
import Link from 'lucide-react/dist/esm/icons/link';
import Map from 'lucide-react/dist/esm/icons/map';
import MapPin from 'lucide-react/dist/esm/icons/map-pin';
import MoreHorizontal from 'lucide-react/dist/esm/icons/more-horizontal';
import Search from 'lucide-react/dist/esm/icons/search';
import Settings from 'lucide-react/dist/esm/icons/settings';
import Shield from 'lucide-react/dist/esm/icons/shield';
import Sparkles from 'lucide-react/dist/esm/icons/sparkles';
import Sun from 'lucide-react/dist/esm/icons/sun';
import Swords from 'lucide-react/dist/esm/icons/swords';
import UserRound from 'lucide-react/dist/esm/icons/user-round';
import styles from './campaign-overview.module.css';
import { campaign } from '@/demo/ashes-of-veyra/campaign';
import { clues } from '@/demo/ashes-of-veyra/clues';
import { encounters } from '@/demo/ashes-of-veyra/encounters';
import { factions } from '@/demo/ashes-of-veyra/factions';
import { npcs } from '@/demo/ashes-of-veyra/npcs';
import { quests } from '@/demo/ashes-of-veyra/quests';
import { useCapabilityNotice } from '@/features/capability-notice';

type Icon = typeof Compass;
type Tone = 'positive' | 'warning' | 'danger' | 'neutral';

interface OverviewRecord {
  id: string;
  title: string;
  subtitle: string;
  meta: string;
  tone?: Tone;
  icon?: Icon;
}

interface OverviewSection {
  id: string;
  title: string;
  icon: Icon;
  records: OverviewRecord[];
}

const navigation: { label: string; icon: Icon }[] = [
  { label: 'Overview', icon: Compass },
  { label: 'Sessions', icon: CalendarDays },
  { label: 'World', icon: Map },
  { label: 'NPCs', icon: UserRound },
  { label: 'Factions', icon: Shield },
  { label: 'Quests', icon: CheckSquare },
  { label: 'Encounters', icon: Swords },
  { label: 'Maps', icon: MapPin },
  { label: 'Lore', icon: BookOpen },
];

const sections: OverviewSection[] = [
  {
    id: 'quests',
    title: 'Active Quests',
    icon: CheckSquare,
    records: quests
      .slice(0, 4)
      .map((quest) => ({
        id: quest.id,
        title: quest.title,
        subtitle: quest.summary,
        meta: quest.status === 'active' ? 'In Progress' : quest.status,
        tone: quest.status === 'active' ? 'positive' : 'warning',
      })),
  },
  {
    id: 'encounters',
    title: 'Prepared Encounters',
    icon: Swords,
    records: encounters
      .slice(0, 4)
      .map((encounter) => ({
        id: encounter.id,
        title: encounter.title,
        subtitle:
          encounter.locationIds[0]?.replace(/-/g, ' ') ?? encounter.kind,
        meta: encounter.difficulty,
        tone:
          encounter.difficulty === 'high'
            ? 'danger'
            : encounter.difficulty === 'moderate'
              ? 'warning'
              : 'neutral',
      })),
  },
  {
    id: 'clues',
    title: 'Unresolved Clues',
    icon: Search,
    records: clues
      .slice(0, 4)
      .map((clue) => ({
        id: clue.id,
        title: clue.title,
        subtitle: clue.meaning,
        meta: clue.priority,
        tone:
          clue.priority === 'high'
            ? 'danger'
            : clue.priority === 'medium'
              ? 'warning'
              : 'neutral',
      })),
  },
  {
    id: 'objects',
    title: 'Recent Campaign Objects',
    icon: FileText,
    records: [
      ...npcs
        .slice(0, 2)
        .map((npc) => ({
          id: npc.id,
          title: npc.name,
          subtitle: 'NPC · ' + npc.role,
          meta: '2 hours ago',
          icon: UserRound,
        })),
      ...factions
        .slice(0, 2)
        .map((faction) => ({
          id: faction.id,
          title: faction.name,
          subtitle: 'Faction · ' + faction.publicFace,
          meta: '1 day ago',
          icon: Shield,
        })),
    ],
  },
];

const activityIcons: Record<string, Icon> = {
  npc: UserRound,
  location: MapPin,
  encounter: Swords,
  quest: CheckSquare,
  faction: Shield,
  map: Map,
};
const backlinks: OverviewRecord[] = campaign.activity.backlinks.map((item) => ({
  id: item.id,
  title: item.label,
  subtitle: item.detail,
  meta: `${item.objectType} link`,
  icon: activityIcons[item.objectType],
}));
const recentEdits: OverviewRecord[] = campaign.activity.recentEdits.map(
  (item) => ({
    id: item.id,
    title: item.label,
    subtitle: item.objectType,
    meta: item.detail,
    icon: activityIcons[item.objectType],
  }),
);
const nextSessionFacts = [
  {
    label: 'Primary Encounter',
    title:
      encounters.find(({ id }) => id === campaign.nextSession.encounterId)
        ?.title ?? '',
    detail: 'CR 4 · 6–8 creatures',
    icon: Swords,
  },
  {
    label: 'Key NPC',
    title: npcs.find(({ id }) => id === campaign.nextSession.npcId)?.name ?? '',
    detail: 'Harbor Master',
    icon: UserRound,
  },
  {
    label: 'Primary Location',
    title: 'Glass Harbor',
    detail: 'Veyra Coast',
    icon: MapPin,
  },
  {
    label: 'Relevant Quest',
    title:
      quests.find(({ id }) => id === campaign.nextSession.questId)?.title ?? '',
    detail: 'In Progress',
    icon: CheckSquare,
  },
];

function IconButton({
  label,
  children,
  onClick,
}: {
  label: string;
  children: ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      className={styles.iconButton}
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export function CampaignOverview() {
  const navigate = useNavigate();
  const { notifyCapability } = useCapabilityNotice();
  const [selected, setSelected] = useState<OverviewRecord>(backlinks[0]);
  const [activeNav, setActiveNav] = useState('Overview');

  const selectRecord = (record: OverviewRecord) => {
    setSelected(record);
  };

  const selectNavigation = (label: string) => {
    setActiveNav(label);
    if (label === 'Sessions') {
      navigate('/campaigns/ashes-of-veyra/sessions/session-12');
      return;
    }
    if (label === 'Maps') {
      navigate('/campaigns/ashes-of-veyra/maps/glass-harbor');
      return;
    }
    if (label !== 'Overview') notifyCapability('campaign.section.open');
  };

  return (
    <div className={styles.layout}>
      <aside className={styles.rail} aria-label="Campaign navigation">
        <div className={styles.brand}>
          <div className={styles.brandMark}>
            <Compass size={25} />
          </div>
          <div>
            <strong>Nexus VTT</strong>
            <span>CAMPAIGN STUDIO</span>
          </div>
        </div>
        <div className={styles.campaignLabel}>Campaigns</div>
        <button
          className={styles.campaignSelect}
          type="button"
          title="Current campaign"
        >
          <span className={styles.liveDot} />
          Ashes of Veyra
          <ChevronDown size={15} />
        </button>
        <nav className={styles.navigation}>
          {navigation.map(({ label, icon: NavIcon }) => (
            <button
              className={`${styles.navItem} ${activeNav === label ? styles.navActive : ''}`}
              key={label}
              type="button"
              onClick={() => selectNavigation(label)}
            >
              <NavIcon size={19} />
              <span>{label}</span>
            </button>
          ))}
        </nav>
        <button
          className={`${styles.navItem} ${styles.settings}`}
          onClick={() => notifyCapability('campaign.settings.open')}
          type="button"
          title="Settings"
        >
          <Settings size={19} />
          <span>Settings</span>
        </button>
      </aside>

      <main className={styles.workspace}>
        <header className={styles.header}>
          <div className={styles.titleBlock}>
            <h1>{campaign.title}</h1>
            <p>{campaign.subtitle}</p>
          </div>
          <div className={styles.headerTools}>
            <span>{campaign.ruleset}</span>
            <span>{campaign.sessionIds.length} Sessions</span>
            <span>Last edited 2 hours ago</span>
            <div className={styles.toolDivider} />
            <IconButton
              label="Search campaign"
              onClick={() => notifyCapability('campaign.search')}
            >
              <Search size={20} />
            </IconButton>
            <IconButton
              label="Change theme"
              onClick={() => notifyCapability('campaign.theme.change')}
            >
              <Sun size={20} />
            </IconButton>
            <button
              className={styles.avatar}
              type="button"
              aria-label="Account"
            >
              AC
            </button>
          </div>
        </header>

        <div className={styles.contentGrid}>
          <div className={styles.primaryContent}>
            <section
              className={styles.nextSession}
              aria-labelledby="next-session-heading"
            >
              <div className={styles.nextTop}>
                <div>
                  <div className={styles.eyebrow}>Next Session</div>
                  <h2 id="next-session-heading">
                    Session 12 - The Glass Harbor
                  </h2>
                  <div className={styles.sessionMeta}>
                    <CalendarDays size={18} />
                    <span>Sat, Apr 26, 2025</span>
                    <span>{campaign.nextSession.time}</span>
                    <span>{campaign.nextSession.relativeDate}</span>
                  </div>
                </div>
                <button
                  className={styles.primaryButton}
                  type="button"
                  onClick={() =>
                    navigate('/campaigns/ashes-of-veyra/sessions/session-12')
                  }
                >
                  <CalendarDays size={18} />
                  <span>Plan Session</span>
                  <ArrowRight size={17} />
                </button>
              </div>
              <div className={styles.sessionFacts}>
                {nextSessionFacts.map(
                  ({ label, title, detail, icon: FactIcon }) => (
                    <button
                      className={styles.fact}
                      type="button"
                      key={label}
                      onClick={() =>
                        selectRecord({
                          id: label,
                          title,
                          subtitle: detail,
                          meta: label,
                          icon: FactIcon,
                        })
                      }
                    >
                      <FactIcon size={22} />
                      <span>
                        <small>{label}</small>
                        <strong>{title}</strong>
                        <em>{detail}</em>
                      </span>
                    </button>
                  ),
                )}
              </div>
            </section>

            <div className={styles.sectionGrid}>
              {sections.map((section) => (
                <section
                  className={styles.dataSection}
                  key={section.id}
                  aria-labelledby={`${section.id}-heading`}
                >
                  <div className={styles.sectionHeader}>
                    <h2 id={`${section.id}-heading`}>
                      <section.icon size={21} />
                      {section.title}
                    </h2>
                    <button
                      className={styles.viewAll}
                      type="button"
                      onClick={() => notifyCapability('campaign.section.open')}
                    >
                      View All
                      <ArrowRight size={15} />
                    </button>
                  </div>
                  <div className={styles.recordList}>
                    {section.records.map((record) => (
                      <div
                        className={`${styles.recordRow} ${selected.id === record.id ? styles.selectedRow : ''}`}
                        key={record.id}
                      >
                        <button
                          className={styles.recordMain}
                          type="button"
                          onClick={() => selectRecord(record)}
                        >
                          <span
                            className={`${styles.statusDot} ${record.tone ? styles[record.tone] : ''}`}
                          />
                          {record.icon && (
                            <record.icon
                              className={styles.recordIcon}
                              size={19}
                            />
                          )}
                          <span className={styles.recordCopy}>
                            <strong>{record.title}</strong>
                            <small>{record.subtitle}</small>
                          </span>
                        </button>
                        <span
                          className={`${styles.recordMeta} ${record.tone ? styles[`meta${record.tone[0].toUpperCase()}${record.tone.slice(1)}`] : ''}`}
                        >
                          {record.meta}
                        </span>
                        <IconButton
                          label={`More actions for ${record.title}`}
                          onClick={() =>
                            notifyCapability('campaign.object.actions')
                          }
                        >
                          <MoreHorizontal size={19} />
                        </IconButton>
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </div>

          <aside className={styles.inspector} aria-label="Activity and links">
            <h2>
              <Link size={20} />
              Activity &amp; Links
            </h2>
            <div className={styles.inspectorSection}>
              <div className={styles.inspectorHeading}>
                <h3>Backlinks</h3>
                <button
                  type="button"
                  onClick={() => notifyCapability('campaign.section.open')}
                >
                  See All
                  <ArrowRight size={14} />
                </button>
              </div>
              {backlinks.map((record) => (
                <button
                  className={`${styles.linkRow} ${selected.id === record.id ? styles.inspectorSelected : ''}`}
                  key={record.id}
                  type="button"
                  onClick={() => selectRecord(record)}
                >
                  {record.icon && <record.icon size={19} />}
                  <span>
                    <strong>{record.title}</strong>
                    <small>{record.meta}</small>
                  </span>
                  <ChevronRight size={16} />
                </button>
              ))}
            </div>
            <div className={styles.inspectorSection}>
              <div className={styles.inspectorHeading}>
                <h3>Recent Edits</h3>
                <button
                  type="button"
                  onClick={() => notifyCapability('campaign.object.history')}
                >
                  See All
                  <ArrowRight size={14} />
                </button>
              </div>
              {recentEdits.map((record) => (
                <button
                  className={`${styles.editRow} ${selected.id === record.id ? styles.inspectorSelected : ''}`}
                  key={record.id}
                  type="button"
                  onClick={() => selectRecord(record)}
                >
                  {record.icon && <record.icon size={19} />}
                  <span>
                    <strong>{record.title}</strong>
                    <small>
                      {record.subtitle}
                      <br />
                      {record.meta}
                    </small>
                  </span>
                </button>
              ))}
            </div>
            <div className={styles.selectionSummary}>
              <div>
                <Sparkles size={15} />
                Selected object
              </div>
              <strong>{selected.title}</strong>
              <span>{selected.subtitle}</span>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
