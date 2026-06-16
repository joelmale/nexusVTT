import React from 'react';
import { DashboardLayout } from './Dashboard/templates/DashboardLayout';
import { Campaign, CharacterRecord } from './Dashboard/types';

// Strictly typed mock campaigns matching UI/Layout specifications
const MOCK_CAMPAIGNS: Campaign[] = [
  {
    id: 'c1',
    name: 'Tomb of Horrors',
    subtitle: 'A race against time to stop a death curse.',
    characterClass: 'Wizard',
    characterRace: 'Human',
    characterLevel: 14,
    updatedAt: '2026-06-16T18:00:00Z',
  },
  {
    id: 'c2',
    name: 'Waterdeep Heist',
    subtitle: 'An urban treasure hunt in the crown jewel of the Sword Coast.',
    characterClass: 'Rogue',
    characterRace: 'Halfling',
    characterLevel: 7,
    updatedAt: '2026-06-15T12:00:00Z',
  },
  {
    id: 'c3',
    name: 'Curse of Strahd',
    subtitle: 'A dark fantasy adventure set in the mist-shrouded valley.',
    characterClass: 'Cleric',
    characterRace: 'Half-Elf',
    characterLevel: 5,
    updatedAt: '2026-06-14T20:00:00Z',
  },
  {
    id: 'c4',
    name: 'Storm King’s Thunder',
    subtitle: 'Giants rampage across the North — restore the ordning.',
    characterClass: 'Barbarian',
    characterRace: 'Goliath',
    characterLevel: 11,
    updatedAt: '2026-06-13T09:00:00Z',
  },
];

// Strictly typed mock characters matching UI/Layout specifications (including core D&D stats)
const MOCK_CHARACTERS: CharacterRecord[] = [
  {
    id: 'char1',
    name: 'Silal',
    level: 14,
    klass: 'Sorcerer',
    race: 'Aasimar',
    xp: 152000,
    hp: { current: 98, max: 98 },
    mana: { current: 45, max: 45 },
    stats: {
      strength: 10,
      dexterity: 15,
      constitution: 14,
      intelligence: 12,
      wisdom: 13,
      charisma: 20,
    },
    updatedAt: '2026-06-16T17:30:00Z',
  },
  {
    id: 'char2',
    name: 'Pyreon',
    level: 3,
    klass: 'Wizard',
    race: 'Human',
    xp: 1400,
    hp: { current: 20, max: 20 },
    mana: { current: 15, max: 15 },
    stats: {
      strength: 8,
      dexterity: 14,
      constitution: 12,
      intelligence: 16,
      wisdom: 12,
      charisma: 10,
    },
    updatedAt: '2026-06-15T22:00:00Z',
  },
  {
    id: 'char3',
    name: 'Zela',
    level: 7,
    klass: 'Rogue',
    race: 'Halfling',
    xp: 27500,
    hp: { current: 48, max: 48 },
    mana: { current: 0, max: 0 },
    stats: {
      strength: 10,
      dexterity: 18,
      constitution: 13,
      intelligence: 14,
      wisdom: 12,
      charisma: 11,
    },
    updatedAt: '2026-06-14T15:00:00Z',
  },
  {
    id: 'char4',
    name: 'Valya',
    level: 5,
    klass: 'Cleric',
    race: 'Half-Elf',
    xp: 9000,
    hp: { current: 39, max: 39 },
    mana: { current: 20, max: 20 },
    stats: {
      strength: 14,
      dexterity: 10,
      constitution: 14,
      intelligence: 10,
      wisdom: 16,
      charisma: 12,
    },
    updatedAt: '2026-06-13T11:00:00Z',
  },
];

export const DashboardNew: React.FC = () => {
  // Handlers for mock player interactions
  const handlePlayCampaign = (campaign: Campaign) => {
    alert(`Entering campaign: ${campaign.name}`);
  };

  const handleEditCampaign = (campaign: Campaign) => {
    alert(`Editing campaign: ${campaign.name}`);
  };

  const handleDeleteCampaign = (campaign: Campaign) => {
    alert(`Deleting campaign: ${campaign.name}`);
  };

  const handleStartCharacterSession = (character: CharacterRecord) => {
    alert(`Starting session with: ${character.name}`);
  };

  const handleEditCharacter = (character: CharacterRecord) => {
    alert(`Editing character sheet for: ${character.name}`);
  };

  const handleDeleteCharacter = (character: CharacterRecord) => {
    alert(`Retiring hero: ${character.name}`);
  };

  const handleCreateCharacter = () => {
    alert('Launching character builder wizard...');
  };

  const handleJoinGame = () => {
    alert('Enter lobby room code to join adventure...');
  };

  const handleImport = () => {
    alert('Importing character sheet JSON/XML...');
  };

  const handleExport = () => {
    alert('Exporting active campaign data...');
  };

  const handleClearAll = () => {
    alert('Clearing local session caches...');
  };

  return (
    <DashboardLayout
      userName="Joel Nelson"
      campaigns={MOCK_CAMPAIGNS}
      characters={MOCK_CHARACTERS}
      loading={false}
      onCreateCharacter={handleCreateCharacter}
      onJoinGame={handleJoinGame}
      onImport={handleImport}
      onExport={handleExport}
      onClearAll={handleClearAll}
      onPlayCampaign={handlePlayCampaign}
      onEditCampaign={handleEditCampaign}
      onDeleteCampaign={handleDeleteCampaign}
      onStartCharacterSession={handleStartCharacterSession}
      onEditCharacter={handleEditCharacter}
      onDeleteCharacter={handleDeleteCharacter}
    />
  );
};

export default DashboardNew;
