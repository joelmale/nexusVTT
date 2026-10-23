import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useGameStore } from '@/stores/gameStore';
import { writeStoredUiMode } from '@/utils/simplePlayerMode';
import styles from './SimpleJoinPage.module.css';

const ROOM_CODE_PATTERN = /^[A-Z0-9]{4}$/;

/**
 * Phone-first join screen behind the DM's invite link (`/play/:roomCode`).
 * Mirrors the lobby quick-join (guest user, then joinRoomWithCode) so session
 * recovery behaves exactly as it does for the full lobby flow, then opens the
 * game in Simple Player Mode.
 */
export const SimpleJoinPage: React.FC = () => {
  const { roomCode: rawRoomCode = '' } = useParams<{ roomCode: string }>();
  const roomCode = rawRoomCode.trim().toUpperCase();
  const navigate = useNavigate();

  const setUser = useGameStore((s) => s.setUser);
  const joinRoomWithCode = useGameStore((s) => s.joinRoomWithCode);
  const autoPlacePlayerToken = useGameStore((s) => s.autoPlacePlayerToken);

  const [name, setName] = useState('');
  const [watchOnly, setWatchOnly] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const validCode = ROOM_CODE_PATTERN.test(roomCode);

  const handleJoin = async (event: React.FormEvent) => {
    event.preventDefault();
    const playerName = name.trim();
    if (!playerName) {
      setError('Please enter your name');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const { isAuthenticated } = useGameStore.getState();
      if (!isAuthenticated) {
        const response = await fetch('/api/guest-users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: playerName }),
          credentials: 'include',
        });
        if (!response.ok) throw new Error('Could not join right now');
        const guestUser = (await response.json()) as Record<string, unknown>;
        setUser({ ...guestUser, type: 'player', isSpectator: watchOnly });
      } else {
        setUser({ name: playerName, type: 'player', isSpectator: watchOnly });
      }

      const joinedRoomCode = await joinRoomWithCode(roomCode);
      writeStoredUiMode('simple');
      if (!watchOnly) {
        setTimeout(() => autoPlacePlayerToken(playerName), 500);
      }
      navigate(`/lobby/game/${joinedRoomCode}`);
    } catch (err) {
      console.error('Simple join failed:', err);
      setError(
        "This game isn't running right now. Ask your DM for a new link.",
      );
    } finally {
      setLoading(false);
    }
  };

  if (!validCode) {
    return (
      <main className={styles.page}>
        <section className={styles.card}>
          <h1 className={styles.title}>Link not recognised</h1>
          <p className={styles.hint}>
            Ask your DM to send the game link again.
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <form className={styles.card} onSubmit={(e) => void handleJoin(e)}>
        <p className={styles.eyebrow}>Joining game</p>
        <h1 className={styles.code}>{roomCode}</h1>

        <label className={styles.label} htmlFor="simple-join-name">
          Your name
        </label>
        <input
          id="simple-join-name"
          className={styles.input}
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="nickname"
          autoCapitalize="words"
          maxLength={40}
          placeholder="e.g. Mia"
          disabled={loading}
        />

        <label className={styles.checkbox}>
          <input
            type="checkbox"
            checked={watchOnly}
            onChange={(e) => setWatchOnly(e.target.checked)}
            disabled={loading}
          />
          Just watching
        </label>

        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}

        <button className={styles.join} type="submit" disabled={loading}>
          {loading ? 'Joining…' : 'Join game'}
        </button>
      </form>
    </main>
  );
};
