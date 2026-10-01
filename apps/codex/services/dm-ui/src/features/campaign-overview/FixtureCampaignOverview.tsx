import CalendarDays from 'lucide-react/dist/esm/icons/calendar-days';
import CheckCircle2 from 'lucide-react/dist/esm/icons/circle-check-big';
import Circle from 'lucide-react/dist/esm/icons/circle';
import Users from 'lucide-react/dist/esm/icons/users';

import type { CampaignCatalogEntry } from '@/demo/campaign-catalog';
import { useCapabilityNotice } from '@/features/capability-notice';
import { StudioFrame } from '@/features/studio-shell/StudioFrame';

import styles from './FixtureCampaignOverview.module.css';

export function FixtureCampaignOverview({
  fixture,
}: {
  fixture: CampaignCatalogEntry;
}) {
  const { notifyCapability } = useCapabilityNotice();

  return (
    <StudioFrame
      contextLabel={fixture.campaign.name}
      onCapability={notifyCapability}
      onSearch={() => notifyCapability('campaign.search.overview')}
      onSettings={() => notifyCapability('campaign.settings.open')}
      onTheme={() => notifyCapability('campaign.theme.change')}
    >
      <main className={styles.workspace}>
        <header className={styles.hero}>
          <div>
            <span className={styles.eyebrow}>Development campaign fixture</span>
            <h1>{fixture.campaign.name}</h1>
            <p className={styles.subtitle}>{fixture.subtitle}</p>
            <p className={styles.premise}>{fixture.premise}</p>
          </div>
          <dl className={styles.metadata}>
            <div>
              <dt>Lifecycle</dt>
              <dd>{fixture.lifecycle}</dd>
            </div>
            <div>
              <dt>Rules</dt>
              <dd>
                {fixture.ruleset} · {fixture.edition}
              </dd>
            </div>
            <div>
              <dt>Showcase</dt>
              <dd>{fixture.showcaseSessions.length} sessions</dd>
            </div>
          </dl>
        </header>

        <section className={styles.party} aria-labelledby="fixture-party">
          <h2 id="fixture-party">
            <Users aria-hidden="true" size={19} /> Party
          </h2>
          <div className={styles.partyGrid}>
            {fixture.playerCharacters.map((character) => (
              <article key={character.id}>
                <strong>{character.name}</strong>
                <span>
                  Level {character.level} {character.ancestry}{' '}
                  {character.className}
                </span>
                <p>{character.hook}</p>
              </article>
            ))}
          </div>
        </section>

        <section
          id="sessions"
          className={styles.sessions}
          aria-labelledby="fixture-sessions"
        >
          <h2 id="fixture-sessions">
            <CalendarDays aria-hidden="true" size={19} /> Session examples
          </h2>
          <div className={styles.sessionGrid}>
            {fixture.showcaseSessions.map((session) => (
              <article className={styles.session} key={session.id}>
                <div className={styles.sessionHeading}>
                  <div>
                    <span>Session {session.number}</span>
                    <h3>{session.title}</h3>
                  </div>
                  <span className={styles.status}>{session.status}</span>
                </div>
                <p>{session.summary}</p>
                {session.plan && (
                  <>
                    <div className={styles.planSummary}>
                      <strong>{session.plan.steps.length} beats</strong>
                      <span>{session.plan.estimatedMinutes} minutes</span>
                      <span>Revision {session.plan.revision}</span>
                    </div>
                    <ol className={styles.beats}>
                      {session.plan.steps.map((step) => (
                        <li key={step.id}>
                          <span>{step.kind}</span>
                          <strong>{step.title}</strong>
                          <small>{step.durationMinutes} min</small>
                        </li>
                      ))}
                    </ol>
                    <ul
                      className={styles.readiness}
                      aria-label={`${session.title} readiness`}
                    >
                      {session.plan.readiness.map((item) => (
                        <li key={item.id}>
                          {item.complete ? (
                            <CheckCircle2 aria-hidden="true" size={15} />
                          ) : (
                            <Circle aria-hidden="true" size={15} />
                          )}
                          <span>{item.label}</span>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </article>
            ))}
          </div>
        </section>
      </main>
    </StudioFrame>
  );
}
