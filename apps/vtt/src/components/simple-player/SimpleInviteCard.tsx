import React, { useState } from 'react';
import { buildSimpleInviteUrl } from '@/utils/simplePlayerMode';
import { QrCode } from './QrCode';
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
  const [largeQr, setLargeQr] = useState(false);
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
      <div className={styles.qrRow}>
        <button
          type="button"
          className={styles.qrButton}
          aria-label="Show the QR code larger"
          onClick={() => setLargeQr(true)}
        >
          <QrCode value={url} size={128} label="QR code for the player link" />
        </button>
        <p className={styles.help}>
          Or share your screen on the video call and let players scan this with
          their phone camera.
        </p>
      </div>
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
      {largeQr && (
        <div
          className={styles.overlay}
          role="dialog"
          aria-modal="true"
          aria-label="Scan to join"
          onClick={() => setLargeQr(false)}
        >
          <QrCode value={url} size={320} label="QR code for the player link" />
          <p>Scan to join game {roomCode.toUpperCase()}</p>
          <button
            type="button"
            className="glass-button"
            onClick={() => setLargeQr(false)}
          >
            Close
          </button>
        </div>
      )}
    </section>
  );
};
