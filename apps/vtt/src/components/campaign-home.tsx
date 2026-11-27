import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';

import { getTableAction } from './Dashboard/tableAction';
import type { LastTable, TableRecord } from './Dashboard/types';
import styles from './CampaignHome.module.css';

interface CampaignHomeProps {
  userName: string;
  tables: TableRecord[];
  lastTable?: LastTable;
  loading: boolean;
  loadFailed: boolean;
  onRetry: () => void;
  onOpenTable: (table: TableRecord) => Promise<void>;
  onJoin: (code: string) => Promise<void>;
  onCreateCampaign: () => void;
}

export function CampaignHome({
  userName,
  tables,
  lastTable,
  loading,
  loadFailed,
  onRetry,
  onOpenTable,
  onJoin,
  onCreateCampaign,
}: CampaignHomeProps) {
  const [roomCode, setRoomCode] = useState('');
  const [joining, setJoining] = useState(false);
  const [opening, setOpening] = useState(false);
  const [joinError, setJoinError] = useState('');
  const roomCodeInput = useRef<HTMLInputElement>(null);
  const recent =
    lastTable &&
    tables.find(
      (table) =>
        table.id === lastTable.campaignId && table.role === lastTable.role,
    );
  const remaining = tables.filter((table) => table !== recent);

  const renderTable = (table: TableRecord, featured = false) => {
    const action = getTableAction(table, featured ? 'band' : 'card');
    return (
      <article
        key={`${table.role}-${table.id}`}
        className={featured ? styles.featured : styles.table}
      >
        <div>
          <p className={styles.role}>
            {table.role === 'dm' ? 'You run this table' : 'Player'}
          </p>
          <h3>{table.name}</h3>
          {table.subtitle && <p>{table.subtitle}</p>}
        </div>
        <button
          className="unstyled"
          type="button"
          disabled={opening || joining || action.disabled}
          title={action.hint}
          onClick={async () => {
            setOpening(true);
            try {
              await onOpenTable(table);
            } finally {
              setOpening(false);
            }
          }}
        >
          {action.label}
        </button>
      </article>
    );
  };

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Link to="/lobby">
          <img
            src={`${import.meta.env.BASE_URL}nexus-icon.svg`}
            alt=""
            width="36"
            height="36"
          />
          Nexus VTT
        </Link>
        <span>{userName}</span>
      </header>
      <div className={styles.shell}>
        <nav
          className={styles.nav}
          aria-label="Campaign Home table of contents"
        >
          <a href="#my-tables" aria-current="page">
            My tables
          </a>
          <a href="#join-a-game" onClick={() => roomCodeInput.current?.focus()}>
            Join a game
          </a>
          <Link to="/lobby?mode=host">Host a game</Link>
          <Link to="/dashboard">Dashboard</Link>
        </nav>
        <main className={styles.content}>
          <div className={styles.title}>
            <h1 id="my-tables">My tables</h1>
            <button
              className="unstyled"
              type="button"
              onClick={onCreateCampaign}
            >
              New campaign
            </button>
          </div>
          <div className={styles.columns}>
            <div className={styles.tables}>
              {loadFailed && (
                <div className={styles.table}>
                  <p role="alert">Your tables could not be loaded.</p>
                  <button className="unstyled" type="button" onClick={onRetry}>
                    Try again
                  </button>
                </div>
              )}
              {loading && <p role="status">Loading tables…</p>}
              {!loading && !loadFailed && tables.length === 0 && (
                <div className={styles.table}>
                  <p>You have no saved tables yet.</p>
                </div>
              )}
              {recent && (
                <section aria-labelledby="recent-table">
                  <h2 id="recent-table">Continue your last table</h2>
                  {renderTable(recent, true)}
                </section>
              )}
              {remaining.length > 0 && (
                <section className={styles.list} aria-labelledby="saved-tables">
                  <h2 id="saved-tables">
                    {recent ? 'Other saved tables' : 'Saved tables'}
                  </h2>
                  {remaining.map((table) => renderTable(table))}
                </section>
              )}
            </div>
            <section
              className={styles.join}
              id="join-a-game"
              aria-labelledby="join-table-heading"
            >
              <h2 id="join-table-heading">Join a game</h2>
              <form
                onSubmit={async (event) => {
                  event.preventDefault();
                  const code = roomCode.trim();
                  if (code.length !== 4 || joining || opening) return;
                  setJoining(true);
                  setJoinError('');
                  try {
                    await onJoin(code);
                  } catch (error) {
                    setJoinError(
                      error instanceof Error
                        ? error.message
                        : 'Could not join the table. Try again.',
                    );
                  } finally {
                    setJoining(false);
                  }
                }}
              >
                <label htmlFor="campaign-room-code">Room code</label>
                <input
                  id="campaign-room-code"
                  ref={roomCodeInput}
                  value={roomCode}
                  onChange={(event) =>
                    setRoomCode(event.target.value.toUpperCase())
                  }
                  maxLength={4}
                  placeholder="ABCD"
                  autoCapitalize="characters"
                  autoComplete="off"
                  spellCheck={false}
                  disabled={joining}
                />
                <button
                  className="unstyled"
                  type="submit"
                  disabled={roomCode.trim().length !== 4 || joining || opening}
                >
                  {joining ? 'Joining…' : 'Join game'}
                </button>
              </form>
              {joinError && <p role="alert">{joinError}</p>}
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}
