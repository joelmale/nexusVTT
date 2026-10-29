import { useEffect, useId, useState, type KeyboardEvent } from 'react';
import Users from 'lucide-react/dist/esm/icons/users';

import {
  inviteCampaignMember,
  listCampaignMembers,
  removeCampaignMember,
  type CampaignMembers,
} from '@/services/campaign-api';

import styles from './CampaignMembersSection.module.css';

function message(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

/**
 * Who can edit this campaign. Co-DMs see the list; only the owner can invite
 * (by the email of an existing Nexus account) or remove them. Rendered inside
 * the settings form, so the invite field submits on Enter by hand instead of
 * nesting a second form.
 */
export function CampaignMembersSection({ campaignId }: { campaignId: string }) {
  const [state, setState] = useState<CampaignMembers>();
  const [email, setEmail] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const inputId = useId();

  useEffect(() => {
    let cancelled = false;
    setState(undefined);
    setError(undefined);
    listCampaignMembers(campaignId)
      .then((members) => {
        if (!cancelled) setState(members);
      })
      .catch((thrown: unknown) => {
        if (!cancelled) setError(message(thrown, 'Could not load co-DMs.'));
      });
    return () => {
      cancelled = true;
    };
  }, [campaignId]);

  const isOwner = state?.role === 'owner';

  async function run(action: () => Promise<CampaignMembers>, fallback: string) {
    setPending(true);
    setError(undefined);
    try {
      setState(await action());
      return true;
    } catch (thrown) {
      setError(message(thrown, fallback));
      return false;
    } finally {
      setPending(false);
    }
  }

  async function invite() {
    const trimmed = email.trim();
    if (!trimmed) {
      setError('Enter the email of their Nexus account.');
      return;
    }
    if (
      await run(
        () => inviteCampaignMember(campaignId, trimmed),
        'Could not invite that co-DM.',
      )
    ) {
      setEmail('');
    }
  }

  function onInviteKey(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    void invite();
  }

  return (
    <section aria-labelledby={`${inputId}-heading`} className={styles.section}>
      <h3 className={styles.heading} id={`${inputId}-heading`}>
        <Users aria-hidden="true" size={15} />
        <span>Co-DMs</span>
      </h3>
      <p className={styles.hint}>
        Co-DMs can edit and publish this campaign&rsquo;s prep.
        {state && !isOwner
          ? ' Only the owner can invite or remove co-DMs.'
          : ' Only you can delete the campaign or change who has access.'}
      </p>

      {state ? (
        <ul className={styles.list}>
          {state.members.map((member) => (
            <li className={styles.member} key={member.userId}>
              <span className={styles.identity}>
                <strong>{member.name}</strong>
                {member.email ? (
                  <span className={styles.email}>{member.email}</span>
                ) : null}
              </span>
              <span className={styles.role}>
                {member.role === 'owner' ? 'Owner' : 'Co-DM'}
              </span>
              {isOwner && member.role === 'co-dm' ? (
                <button
                  aria-label={`Remove ${member.name}`}
                  className={styles.remove}
                  disabled={pending}
                  onClick={() =>
                    void run(
                      () => removeCampaignMember(campaignId, member.userId),
                      'Could not remove that co-DM.',
                    )
                  }
                  type="button"
                >
                  Remove
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : error ? null : (
        <p className={styles.hint} role="status">
          Loading co-DMs…
        </p>
      )}

      {isOwner ? (
        <div className={styles.invite}>
          <label className={styles.inviteLabel} htmlFor={inputId}>
            Invite by account email
          </label>
          <div className={styles.inviteRow}>
            <input
              autoComplete="off"
              disabled={pending}
              id={inputId}
              onChange={(event) => setEmail(event.target.value)}
              onKeyDown={onInviteKey}
              placeholder="friend@example.com"
              type="email"
              value={email}
            />
            <button
              className={styles.inviteButton}
              disabled={pending}
              onClick={() => void invite()}
              type="button"
            >
              {pending ? 'Working…' : 'Invite'}
            </button>
          </div>
        </div>
      ) : null}

      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
