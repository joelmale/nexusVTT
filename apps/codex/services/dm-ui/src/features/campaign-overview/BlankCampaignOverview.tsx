import CalendarDays from 'lucide-react/dist/esm/icons/calendar-days';
import FileText from 'lucide-react/dist/esm/icons/file-text';
import Map from 'lucide-react/dist/esm/icons/map';
import Search from 'lucide-react/dist/esm/icons/search';
import Swords from 'lucide-react/dist/esm/icons/swords';
import UserRound from 'lucide-react/dist/esm/icons/user-round';

import type { CampaignSummary } from '@/services/campaign-api';

import styles from './BlankCampaignOverview.module.css';

const EMPTY_SECTIONS = [
  {
    description: 'Session plans will appear here after you create them.',
    icon: CalendarDays,
    title: 'Sessions',
  },
  {
    description: 'No maps or prepared scenes have been added.',
    icon: Map,
    title: 'Maps',
  },
  {
    description: 'No NPC profiles belong to this campaign yet.',
    icon: UserRound,
    title: 'NPCs',
  },
  {
    description: 'No encounters have been prepared.',
    icon: Swords,
    title: 'Encounters',
  },
  {
    description: 'No clues or campaign notes have been authored.',
    icon: Search,
    title: 'Clues & notes',
  },
  {
    description: 'Campaign activity will appear after the first change.',
    icon: FileText,
    title: 'Recent activity',
  },
] as const;

export function BlankCampaignOverview({
  campaign,
}: {
  campaign: CampaignSummary;
}) {
  return (
    <main className={styles.workspace}>
      <header className={styles.header}>
        <div>
          <span>Campaign overview</span>
          <h1>{campaign.name}</h1>
          <p>
            {campaign.description ||
              'A blank campaign ready for your world, sessions, and cast.'}
          </p>
        </div>
        <button
          disabled
          title="Campaign authoring is coming next"
          type="button"
        >
          Add campaign object
        </button>
      </header>

      <section className={styles.welcome}>
        <h2>This campaign is empty</h2>
        <p>
          Nothing from the Ashes of Veyra sample has been copied here. Build
          only the material you want for this campaign.
        </p>
      </section>

      <div className={styles.grid}>
        {EMPTY_SECTIONS.map(({ description, icon: Icon, title }) => (
          <section className={styles.emptySection} key={title}>
            <Icon aria-hidden="true" size={20} />
            <div>
              <h2>{title}</h2>
              <p>{description}</p>
            </div>
            <strong>0</strong>
          </section>
        ))}
      </div>
    </main>
  );
}
