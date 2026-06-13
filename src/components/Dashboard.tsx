import React, { useEffect, useState, lazy, Suspense } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useGameStore, useSettings } from '@/stores/gameStore';
import { CharacterManager } from './CharacterManager';
import { CharacterImportModal } from './CharacterImportModal';
import { CharacterSelectionModal } from './CharacterSelectionModal';
import { useCharacterCreationLauncher } from '@/hooks';
import { DocumentLibrary } from './DocumentLibrary';
import { createEmptyCharacter, type Character } from '@/types/character';
import { normalizeCharacter } from '@/utils/characterNormalization';
import type { PlayerCharacter } from '@/types/game';
import '@/styles/dashboard.css';

// Lazy-load the Tailwind Dashboard only when the feature flag is on
const DashboardTailwind = lazy(() =>
  import('./DashboardTailwind').then((mod) => ({ default: mod.DashboardTailwind })),
);

// Direct Lucide Path Imports (GEMINI.md Foundation Rule)
import Shield from 'lucide-react/dist/esm/icons/shield';
import Download from 'lucide-react/dist/esm/icons/download';
import Trash2 from 'lucide-react/dist/esm/icons/trash-2';
import Play from 'lucide-react/dist/esm/icons/play';
import Edit2 from 'lucide-react/dist/esm/icons/edit-2';
import Home from 'lucide-react/dist/esm/icons/home';
import Sparkles from 'lucide-react/dist/esm/icons/sparkles';
import AlertTriangle from 'lucide-react/dist/esm/icons/alert-triangle';

/**
 * Campaign data structure from API
 */
interface Campaign {
  id: string;
  name: string;
  description: string | null;
  dmId: string;
  scenes: unknown;
  lastRoomCode?: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Character record from the database
 */
interface CharacterRecord {
  id: string;
  name: string;
  ownerId: string;
  data: {
    race?: string;
    class?: string;
    level?: number;
    [key: string]: unknown;
  };
  createdAt: string;
  updatedAt: string;
}

/**
 * High-Density Immersive VTT Dashboard (legacy implementation)
 * Renamed to DashboardLegacy so the exported Dashboard can act as a
 * hook-safe feature-flag switcher (Rules of Hooks requirement).
 */
const DashboardLegacy: React.FC = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated, joinRoomWithCode } = useGameStore();
  const { startCharacterCreation, LauncherComponent } = useCharacterCreationLauncher();

  // Database States
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [characters, setCharacters] = useState<CharacterRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [charactersLoading, setCharactersLoading] = useState(true);
  const [authChecking, setAuthChecking] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Flow States
  const [showNewCampaignModal, setShowNewCampaignModal] = useState(false);
  const [showJoinGameModal, setShowJoinGameModal] = useState(false);
  const [showCharacterModal, setShowCharacterModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showCharacterSelectionModal, setShowCharacterSelectionModal] = useState(false);
  
  const [newCampaignName, setNewCampaignName] = useState('');
  const [newCampaignDescription, setNewCampaignDescription] = useState('');
  const [creatingCampaign, setCreatingCampaign] = useState(false);
  const [joinRoomCode, setJoinRoomCode] = useState('');
  const [joiningGame, setJoiningGame] = useState(false);
  const [editingCharacter, setEditingCharacter] = useState<CharacterRecord | undefined>(undefined);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [campaignBackupExporting, setCampaignBackupExporting] = useState(false);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [startingSession, setStartingSession] = useState<string | null>(null);
  const [joiningCampaign, setJoiningCampaign] = useState<Campaign | null>(null);

  // Computed data
  const recentCampaigns = [...campaigns]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 4);

  const recentCharacters = [...characters]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 12);

  const normalizedCharactersForSelection: Character[] = characters.map(c => buildCharacterFromRecordInternal(c, user.id));

  // Lifecycle
  useEffect(() => {
    const timer = setTimeout(() => {
      setAuthChecking(false);
      if (!isAuthenticated) navigate('/lobby');
    }, 1000);
    return () => clearTimeout(timer);
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    if (!isAuthenticated) return;
    const fetchData = async () => {
      try {
        setLoading(true);
        const [campRes, charRes] = await Promise.all([
          fetch('/api/campaigns', { credentials: 'include' }),
          fetch('/api/characters', { credentials: 'include' })
        ]);
        if (campRes.ok) setCampaigns(await campRes.json());
        if (charRes.ok) setCharacters(await charRes.json());
      } catch {
        setError('Lost connection to archives.');
      } finally {
        setLoading(false);
        setCharactersLoading(false);
      }
    };
    fetchData();
  }, [isAuthenticated]);

  // Handlers
  const handleCreateCampaign = async () => {
    if (!newCampaignName.trim()) return;
    setCreatingCampaign(true);
    try {
      const res = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newCampaignName.trim(), description: newCampaignDescription.trim() }),
        credentials: 'include',
      });
      if (!res.ok) throw new Error();
      const newCamp = await res.json();
      setCampaigns([newCamp, ...campaigns]);
      setShowNewCampaignModal(false);
      setNewCampaignName('');
    } catch {
      setError('Forge failed to strike.');
    } finally {
      setCreatingCampaign(false);
    }
  };

  const handleJoinGame = async () => {
    if (!joinRoomCode.trim()) return;
    setJoiningGame(true);
    try {
      await joinRoomWithCode(joinRoomCode.trim().toUpperCase());
      navigate('/game');
    } catch {
      setError('The SIGIL is invalid.');
    } finally {
      setJoiningGame(false);
    }
  };

  const handleStartSession = async (campaignId: string) => {
    const campaign = campaigns.find(c => c.id === campaignId);
    if (!campaign) return;
    setStartingSession(campaignId);
    setJoiningCampaign(campaign);
    setShowCharacterSelectionModal(true);
  };

  const handleCharacterSelected = async (char: Character | null, joinAsSpectator: boolean) => {
    if (!joiningCampaign || (!char && !joinAsSpectator)) return;
    const { joinRoomWithCode: joinWithCode } = useGameStore.getState();
    try {
      const response = await fetch(`/api/campaigns/${joiningCampaign.id}/start`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!response.ok) throw new Error();
      const { roomCode } = await response.json();
      
      const playerChar: PlayerCharacter | undefined = char ? convertCharacterToPlayerCharacter(char) : undefined;
      await joinWithCode(roomCode, playerChar);
      navigate('/game');
    } catch {
      setError('Ritual failed.');
    } finally {
      setShowCharacterSelectionModal(false);
      setJoiningCampaign(null);
      setStartingSession(null);
    }
  };

  const handleCreateCharacter = () => {
    if (user.id) {
      startCharacterCreation(user.id, 'modal', (_id: string, char?: unknown) => {
        if (char) handleSaveCharacter(char as CharacterRecord);
      });
    }
  };

  const handleEditCharacter = (character: CharacterRecord) => {
    setEditingCharacter(character);
    setShowCharacterModal(true);
  };

  const handleSaveCharacter = (char: CharacterRecord) => {
    setCharacters(prev => {
      const idx = prev.findIndex(c => c.id === char.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = char;
        return next;
      }
      return [char, ...prev];
    });
    setShowCharacterModal(false);
    setEditingCharacter(undefined);
  };

  const handleDeleteCharacter = async (id: string) => {
    if (!window.confirm('Vanish this hero?')) return;
    try {
      const res = await fetch(`/api/characters/${id}`, { method: 'DELETE', credentials: 'include' });
      if (res.ok) setCharacters(prev => prev.filter(c => c.id !== id));
    } catch {
      setError('The hero resisted.');
    }
  };

  const handleClearAllCharacters = async () => {
    if (!window.confirm('WIPE ALL HEROES?')) return;
    try {
      const res = await fetch('/api/characters', { method: 'DELETE', credentials: 'include' });
      if (res.ok) setCharacters([]);
    } catch {
      setError('Purge failed.');
    }
  };

  const handleExportCampaignBackup = async () => {
    if (!selectedCampaignId) return alert('Select campaign.');
    setCampaignBackupExporting(true);
    try {
      const { downloadCampaignBackup, buildCampaignBackup } = await import('@/services/campaignBackup');
      // @ts-expect-error - selectedCampaignId is string but buildCampaignBackup expects Campaign object in some versions
      const backup = await buildCampaignBackup(selectedCampaignId);
      downloadCampaignBackup(backup);
    } finally {
      setCampaignBackupExporting(false);
    }
  };

  const handleImportCampaignBackup = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const { parseCampaignBackup, applyCampaignBackupAssets } = await import('@/services/campaignBackup');
        const content = await file.text();
        const backup = parseCampaignBackup(content as any);
        await applyCampaignBackupAssets(backup as any);
        setImportMessage('Restored.');
        setTimeout(() => setImportMessage(null), 5000);
      } catch {
        setError('Import failed.');
      }
    };
    input.click();
  };

  const handleImportComplete = (result: { successful: number; failed: number }) => {
    setImportMessage(`Import complete: ${result.successful} successful, ${result.failed} failed.`);
    setTimeout(() => setImportMessage(null), 5000);
  };

  function buildCharacterFromRecordInternal(record: CharacterRecord, fallbackId: string): Character {
    const data = record.data;
    const base = createEmptyCharacter(record.ownerId || fallbackId);
    const level = typeof data.level === 'number' ? data.level : base.level;
    const raceName = typeof data.race === 'string' ? data.race : (base.race || '');
    const className = typeof data.class === 'string' ? data.class : '';
    const input: any = {
      ...base,
      id: record.id,
      name: record.name,
      playerId: record.ownerId || base.playerId,
      level,
      race: raceName,
      species: raceName || base.species,
      class: className,
      background: typeof data.background === 'string' ? data.background : base.background,
      createdAt: record.createdAt || base.createdAt,
      updatedAt: record.updatedAt || base.updatedAt,
    };
    return normalizeCharacter(input, { playerId: input.playerId, baseCharacter: base });
  }

  const convertCharacterToPlayerCharacter = (character: Character): PlayerCharacter => {
    const createdAt = typeof character.createdAt === 'string' ? Date.parse(character.createdAt) : Date.now();
    return {
      id: character.id,
      name: character.name,
      race: character.race || character.species || '',
      class: character.class || '',
      background: character.background || '',
      level: character.level,
      stats: {
        strength: character.abilities.STR.score,
        dexterity: character.abilities.DEX.score,
        constitution: character.abilities.CON.score,
        intelligence: character.abilities.INT.score,
        wisdom: character.abilities.WIS.score,
        charisma: character.abilities.CHA.score,
      },
      createdAt: Number.isFinite(createdAt) ? createdAt : Date.now(),
      playerId: character.playerId || '',
    };
  };

  if (authChecking) {
    return (
      <div className="min-h-screen bg-vtt-iron-900 flex items-center justify-center">
        <Shield className="w-16 h-16 text-vtt-bronze animate-pulse" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-vtt-iron-900 font-interface selection:bg-vtt-amber-glow selection:text-white pb-6 overflow-x-hidden">
      
      <header className="flex justify-between items-center px-6 py-4 bg-[#181a1d] border-b border-vtt-iron-700 shadow-xl">
        <h1 className="text-[28px] font-fantasy text-vtt-parchment italic tracking-tight" style={{ fontFamily: 'Cinzel Decorative, serif' }}>
          Welcome, {user.name || user.displayName || 'Adventurer'}!
        </h1>
        <div className="flex items-center gap-6">
          <button onClick={() => navigate('/lobby')} className="flex items-center gap-2 text-[13px] font-bold tracking-wide text-vtt-parchment/60 hover:text-vtt-parchment transition-colors bg-vtt-iron-800 border border-vtt-iron-700 px-4 py-1.5 rounded-sm shadow-md"><Home className="w-4 h-4 text-vtt-bronze" /> Return to Lobby</button>
          <div className="flex items-center gap-3 bg-vtt-iron-800 border border-vtt-iron-700 px-4 py-2 rounded shadow-inner">
            <Shield className="w-8 h-8 text-vtt-bronze" strokeWidth={1.5} />
            <div className="text-[11px] text-vtt-parchment/70 font-bold uppercase tracking-tighter leading-tight border-l border-vtt-iron-700 pl-3">
              <div>Campaigns: <span className="text-vtt-parchment ml-1">{campaigns.length}</span></div>
              <div>Characters: <span className="text-vtt-parchment ml-1">{characters.length}</span></div>
            </div>
          </div>
        </div>
      </header>

      <div className="w-full bg-gradient-to-b from-[#947656] via-[#7d5d3e] to-[#593d25] border-y border-[#b89a7a] px-6 py-2 flex justify-between items-center shadow-2xl relative z-20">
        <div className="flex items-center gap-6">
          <button onClick={handleCreateCharacter} className="flex items-center gap-2 text-white hover:text-vtt-parchment text-sm font-bold transition-colors drop-shadow-lg" disabled={charactersLoading}>⚔️ Create Character</button>
          <div className="w-px h-5 bg-black/30" />
          <button onClick={() => setShowJoinGameModal(true)} className="flex items-center gap-2 text-white hover:text-vtt-parchment text-sm font-bold transition-colors drop-shadow-lg">🗺️ Join Game</button>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={() => setShowImportModal(true)} className="flex items-center gap-1.5 text-white hover:text-vtt-parchment text-[12px] font-bold transition-colors">📥 Import</button>
          <button onClick={handleExportCampaignBackup} disabled={campaignBackupExporting} className="flex items-center gap-1.5 text-white hover:text-vtt-parchment text-[12px] font-bold transition-colors disabled:opacity-30">📤 {campaignBackupExporting ? 'Exporting...' : 'Export'}</button>
          <div className="w-px h-5 bg-black/30" />
          <button onClick={handleClearAllCharacters} className="flex items-center gap-1.5 text-white hover:text-red-400 text-[12px] font-bold transition-colors">🗑️ Clear All ▾</button>
        </div>
      </div>

      {error && <div className="max-w-[1800px] mx-auto mt-4 px-4"><div className="bg-[#592525] border border-[#a84444] text-vtt-parchment px-4 py-2 rounded text-sm flex items-center gap-2 shadow-lg"><AlertTriangle className="w-4 h-4 text-red-400" /> {error}</div></div>}
      {importMessage && <div className="max-w-[1800px] mx-auto mt-4 px-4"><div className="bg-[#254a31] border border-[#44a867] text-vtt-parchment px-4 py-2 rounded text-sm flex items-center gap-2 shadow-lg"><Sparkles className="w-4 h-4 text-green-400" /> {importMessage}</div></div>}

      <main className="max-w-[1800px] mx-auto grid grid-cols-1 xl:grid-cols-4 gap-6 p-6">
        <div className="xl:col-span-3 flex flex-col gap-8">
          <section>
            <SectionHeading title="Recent Campaigns" />
            <div className="flex gap-2 mb-4">
              <button onClick={handleImportCampaignBackup} className="flex items-center gap-1.5 text-[10px] uppercase font-bold bg-vtt-iron-700 text-vtt-parchment/80 border border-vtt-iron-700 px-3 py-1.5 rounded shadow-sm hover:text-vtt-parchment transition-colors"><Download className="w-3 h-3 text-vtt-bronze" /> Import Backup</button>
              <button onClick={() => setShowNewCampaignModal(true)} className="flex items-center gap-1.5 text-[10px] uppercase font-bold bg-vtt-iron-700 text-vtt-parchment/80 border border-vtt-iron-700 px-3 py-1.5 rounded shadow-sm hover:text-vtt-parchment transition-colors">➕ New Campaign</button>
            </div>

            {loading ? <GridSkeleton count={4} /> : campaigns.length === 0 ? <EmptyState icon={<Shield className="w-12 h-12" />} title="The realm lies fallow..." desc="Forge your first campaign." /> : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 px-1">
                {recentCampaigns.map((camp) => (
                  <article key={camp.id} className="flex flex-col bg-vtt-parchment border border-[#c1ae92] rounded shadow-[0_6px_16px_rgba(0,0,0,0.7)] text-vtt-parchment-text p-4 h-full relative overflow-hidden transition-all hover:-translate-y-1 hover:shadow-vtt-amber-glow/20">
                    <div className="relative z-10 flex-1">
                      <h4 className="text-[16px] font-bold leading-tight uppercase tracking-tight border-b border-[#d2c0a4] pb-2 mb-3 truncate">{camp.name}</h4>
                      <p className="text-[11px] leading-relaxed font-medium italic opacity-80 min-h-[3.5em]">{camp.description || 'An untold story...'}</p>
                      <div className="flex justify-between items-center mt-4 text-[9px] font-black uppercase tracking-widest opacity-40"><span>Chronics</span><span>{new Date(camp.updatedAt).toLocaleDateString()}</span></div>
                    </div>
                    <div className="relative z-10 flex items-center gap-4 mt-5 pt-3 border-t border-[#d2c0a4]">
                      <button className="flex items-center gap-1.5 text-[11px] font-bold hover:text-vtt-amber-glow transition-colors"><Edit2 className="w-3 h-3" /> Edit</button>
                      <label className="flex items-center gap-1.5 text-[10px] font-black uppercase cursor-pointer hover:text-vtt-amber-glow ml-auto"><input type="radio" name="selected-campaign" className="w-3.5 h-3.5 accent-vtt-bronze" checked={selectedCampaignId === camp.id} onChange={() => setSelectedCampaignId(camp.id)} /><span>Backup</span></label>
                      <button onClick={() => handleStartSession(camp.id)} disabled={startingSession !== null} className="flex items-center gap-2 bg-vtt-parchment-text text-vtt-parchment px-4 py-1.5 rounded text-[10px] font-black uppercase tracking-widest hover:bg-black transition-all shadow-md active:scale-95"><Play className="w-3 h-3 fill-current" /> Begin</button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section>
            <SectionHeading title="Recent Characters" />
            <div className="flex gap-2 mb-4">
              <button onClick={handleCreateCharacter} className="flex items-center gap-1.5 text-[10px] uppercase font-bold bg-vtt-iron-700 text-vtt-parchment/80 border border-vtt-iron-700 px-3 py-1.5 rounded shadow-sm hover:text-vtt-parchment transition-colors">➕ New Hero</button>
            </div>

            {charactersLoading ? <GridSkeleton count={8} /> : characters.length === 0 ? <EmptyState icon={<Shield className="w-12 h-12" />} title="No heroes answered..." desc="Forge your hero." /> : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 px-1">
                {recentCharacters.map((char) => (
                  <article key={char.id} className="flex flex-col bg-vtt-parchment border border-[#c1ae92] rounded shadow-[0_6px_16px_rgba(0,0,0,0.7)] text-vtt-parchment-text p-4 h-full relative overflow-hidden transition-all hover:-translate-y-1">
                    <div className="relative z-10 flex-1">
                      <div className="flex justify-between items-start mb-2"><h4 className="text-[16px] font-bold leading-tight uppercase tracking-tight truncate max-w-[120px]">{char.name}</h4><span className="text-[10px] font-black text-white bg-vtt-iron-900 px-2 py-0.5 rounded uppercase">LVL {char.data.level || 1}</span></div>
                      <p className="text-[11px] leading-snug font-bold opacity-60 mb-3 border-l-2 border-vtt-bronze pl-2">{char.data.race || 'Unknown'} • {char.data.class || 'Hero'}</p>
                      <div className="w-full h-1 bg-[#d2c0a4] rounded-full mt-3 mb-4 overflow-hidden shadow-inner"><div className="h-full bg-vtt-bronze" style={{ width: '60%' }} /></div>
                      <div className="text-[9px] font-black uppercase opacity-40">Observed {new Date(char.updatedAt).toLocaleDateString()}</div>
                    </div>
                    <div className="relative z-10 flex items-center gap-4 mt-5 pt-3 border-t border-[#d2c0a4]">
                      <button onClick={() => handleEditCharacter(char)} className="flex items-center gap-1.5 text-[11px] font-bold hover:text-vtt-amber-glow transition-colors"><Edit2 className="w-3 h-3" /> Edit</button>
                      <button onClick={() => handleDeleteCharacter(char.id)} className="flex items-center gap-1.5 text-[11px] font-bold text-red-800 hover:text-red-600 transition-colors ml-auto"><Trash2 className="w-3 h-3" /> Exile</button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
        <aside className="xl:col-span-1 flex flex-col h-full pl-4 border-l border-vtt-iron-700/50">
          <DocumentLibrary />
        </aside>
      </main>

      {showNewCampaignModal && (
        <Modal onClose={() => setShowNewCampaignModal(false)} title="Forge New Chronicle">
          <div className="space-y-6">
            <div><label className="block text-[11px] font-black uppercase tracking-widest text-vtt-bronze mb-2">Title</label><input type="text" value={newCampaignName} onChange={(e) => setNewCampaignName(e.target.value)} className="w-full bg-vtt-iron-900 border border-vtt-iron-700 rounded-lg p-4 text-vtt-parchment focus:border-vtt-amber-glow shadow-inner" /></div>
            <div><label className="block text-[11px] font-black uppercase tracking-widest text-vtt-bronze mb-2">Prophecy</label><textarea value={newCampaignDescription} onChange={(e) => setNewCampaignDescription(e.target.value)} className="w-full bg-vtt-iron-900 border border-vtt-iron-700 rounded-lg p-4 text-vtt-parchment focus:border-vtt-amber-glow shadow-inner resize-none" rows={5} /></div>
          </div>
          <button className="w-full py-5 mt-10 bg-gradient-to-b from-vtt-bronze to-[#593d25] text-white rounded-xl font-black uppercase tracking-widest shadow-xl active:scale-95" onClick={handleCreateCampaign} disabled={!newCampaignName.trim() || creatingCampaign}>{creatingCampaign ? 'Forgeing...' : 'Seal the Pact'}</button>
        </Modal>
      )}

      {showJoinGameModal && (
        <Modal onClose={() => setShowJoinGameModal(false)} title="Cross the Threshold">
          <div className="space-y-6 mt-8"><input type="text" value={joinRoomCode} onChange={(e) => setJoinRoomCode(e.target.value.toUpperCase())} placeholder="SIGIL" className="w-full bg-vtt-iron-900 border-2 border-vtt-iron-700 rounded-xl p-5 text-4xl text-vtt-amber-glow uppercase text-center font-black tracking-[0.8em]" maxLength={6} /></div>
          <button className="w-full py-5 mt-10 bg-gradient-to-b from-vtt-bronze to-[#593d25] text-white rounded-xl font-black uppercase tracking-widest shadow-xl active:scale-95" onClick={handleJoinGame} disabled={!joinRoomCode.trim() || joiningGame}>{joiningGame ? 'Transcending...' : 'Enter the Realm'}</button>
        </Modal>
      )}

      {showCharacterModal && editingCharacter && (
        <CharacterManager character={editingCharacter as any} onClose={() => { setShowCharacterModal(false); setEditingCharacter(undefined); }} onSave={(char: any) => handleSaveCharacter({ ...editingCharacter, name: char.name, data: { ...editingCharacter.data, race: char.race, class: char.class, level: char.level } })} />
      )}

      {showImportModal && (
        <CharacterImportModal isOpen={showImportModal} onClose={() => setShowImportModal(false)} onImportComplete={handleImportComplete} />
      )}

      {showCharacterSelectionModal && joiningCampaign && (
        <CharacterSelectionModal isOpen={showCharacterSelectionModal} onClose={() => { setShowCharacterSelectionModal(false); setJoiningCampaign(null); setStartingSession(null); }} onSelect={handleCharacterSelected} availableCharacters={normalizedCharactersForSelection} campaignId={joiningCampaign.id} campaignName={joiningCampaign.name} />
      )}

      {LauncherComponent && createPortal(LauncherComponent, document.body)}
    </div>
  );
};

// UI Components
const SectionHeading: React.FC<{ title: string }> = ({ title }) => (
  <div className="flex items-center justify-between bg-gradient-to-r from-vtt-iron-800 to-transparent border-y border-vtt-iron-700 py-2 px-4 mb-4 shadow-md">
    <h3 className="text-xl font-fantasy text-vtt-parchment italic tracking-wide">{title}</h3>
  </div>
);

const GridSkeleton: React.FC<{ count: number }> = ({ count }) => (
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="h-40 bg-vtt-iron-800 animate-pulse rounded border border-vtt-iron-700" />
    ))}
  </div>
);

const EmptyState: React.FC<{ icon: React.ReactNode, title: string, desc: string }> = ({ icon, title, desc }) => (
  <div className="bg-vtt-iron-800 border border-vtt-iron-700 rounded-lg p-12 text-center shadow-inner text-vtt-parchment/40 italic">
    <div className="mx-auto mb-3 opacity-20 flex justify-center">{icon}</div>
    <h3 className="text-vtt-parchment font-fantasy text-lg mb-1">{title}</h3>
    <p className="text-[12px]">{desc}</p>
  </div>
);

const Modal: React.FC<{ onClose: () => void, title: string, children: React.ReactNode }> = ({ onClose, title, children }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md px-4" onClick={onClose}>
    <div className="bg-vtt-iron-800 border border-vtt-bronze/40 rounded-xl p-8 w-full max-w-md shadow-2xl relative" onClick={(e) => e.stopPropagation()}>
      <h2 className="text-2xl font-fantasy text-vtt-parchment mb-6 text-center italic border-b border-vtt-iron-700 pb-4">{title}</h2>
      {children}
      <button className="w-full py-2 mt-4 text-[10px] font-black uppercase tracking-widest text-vtt-parchment/30 hover:text-vtt-parchment transition-colors" onClick={onClose}>Retract</button>
    </div>
  </div>
);

/**
 * Feature-flag switcher. This is the component exported to routes.
 * It reads the settings flag and delegates to either the Tailwind
 * redesign or the legacy implementation. No hooks are called after
 * a conditional return here, so it is Rules-of-Hooks compliant.
 */
export const Dashboard: React.FC = () => {
  const settings = useSettings();

  if (settings.enableTailwindDashboard) {
    return (
      <Suspense fallback={<div className="loading-spinner">Loading dashboard...</div>}>
        <DashboardTailwind />
      </Suspense>
    );
  }

  return <DashboardLegacy />;
};
