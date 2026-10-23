import React, { useState } from 'react';
import { buildSimpleInviteUrl } from '@/utils/simplePlayerMode';
import styles from './SimpleInviteCard.module.css';

export interface SimpleInviteCardProps {
  roomCode: string;
}

/**
 * DM-side invite for Simple Player Mode: one link that drops a phone or
 * tablet player straight into the game, no account needed.
 */
export const SimpleInviteCard: React.FC<SimpleInviteCardProps> = ({
  roomCode,
}) => {
  const url = buildSimpleInviteUrl(roomCode);
  const [copied, setCopied] = useState(false);
  const canShare = typeof navigator.share === 'function';

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  const share = () => {
    void navigator
      .share({ title: 'Join my D&D game!', url })
      .catch(() => undefined);
  };

  return (
    <section className={styles.card} aria-labelledby="simple-invite-title">
      <h4 id="simple-invite-title">Invite phone &amp; tablet players</h4>
      <p className={styles.help}>
        Send this link. Players tap it, type their name and land in a simple
        view with the map, their character, turn order and dice.
      </p>
      <input
        className={styles.link}
        readOnly
        value={url}
        aria-label="Simple player link"
        onFocus={(e) => e.currentTarget.select()}
      />
      <div className={styles.actions}>
        <button
          type="button"
          className="glass-button small"
          onClick={() => void copy()}
        >
          {copied ? 'Copied!' : 'Copy Simple Player Link'}
        </button>
        {canShare && (
          <button type="button" className="glass-button small" onClick={share}>
            Share…
          </button>
        )}
      </div>
      <p className={styles.tip}>
        Tip: on an iPad, players can keep the video call and Nexus side by side
        in Split View.
      </p>
    </section>
  );
};
