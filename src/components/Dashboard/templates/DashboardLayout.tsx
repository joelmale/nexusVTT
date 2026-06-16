import React, { useState } from 'react';
import { Campaign, CharacterRecord } from '../types';
import { Header } from '../organisms/Header';
import { ActionBar } from '../organisms/ActionBar';
import { CampaignGrid } from '../organisms/CampaignGrid';
import { CharacterGrid } from '../organisms/CharacterGrid';
import { DocumentSidebar } from '../organisms/DocumentSidebar';
import { DiceRoller } from '../molecules/DiceRoller';

interface DashboardLayoutProps {
  userName: string;
  campaigns: Campaign[];
  characters: CharacterRecord[];
  loading?: boolean;

  onCreateCharacter?: () => void;
  onJoinGame?: () => void;
  onImport?: () => void;
  onExport?: () => void;
  onClearAll?: () => void;

  onPlayCampaign?: (campaign: Campaign) => void;
  onEditCampaign?: (campaign: Campaign) => void;
  onDeleteCampaign?: (campaign: Campaign) => void;
  onCreateCampaign?: () => void;

  onStartCharacterSession?: (char: CharacterRecord) => void;
  onEditCharacter?: (char: CharacterRecord) => void;
  onDeleteCharacter?: (char: CharacterRecord) => void;

  className?: string;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({
  userName,
  campaigns,
  characters,
  loading = false,

  onCreateCharacter,
  onJoinGame,
  onImport,
  onExport,
  onClearAll,

  onPlayCampaign,
  onEditCampaign,
  onDeleteCampaign,
  onCreateCampaign,

  onStartCharacterSession,
  onEditCharacter,
  onDeleteCharacter,

  className = '',
}) => {
  // Generate static random values once on component instantiation to avoid cascading re-renders and keep render loop pure
  const [embers] = useState(() =>
    Array.from({ length: 15 }).map((_, idx) => ({
      id: idx,
      left: Math.random() * 100,
      size: Math.random() * 4 + 2,
      duration: Math.random() * 5 + 4,
      delay: Math.random() * 5,
    }))
  );

  return (
    <div
      className={`
        relative min-h-screen bg-[#121417] text-[#f1e6d3] font-sans p-4 md:p-6
        flex flex-col gap-6 overflow-hidden z-10
        ${className}
      `}
    >
      {/* Dynamic background texture */}
      <div
        className="absolute inset-0 opacity-[0.02] pointer-events-none mix-blend-overlay z-0"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* Top Header */}
      <Header
        userName={userName}
        campaignCount={campaigns.length}
        characterCount={characters.length}
        className="relative z-10"
      />

      {/* Action Bar */}
      <ActionBar
        onCreateCharacter={onCreateCharacter}
        onJoinGame={onJoinGame}
        onImport={onImport}
        onExport={onExport}
        onClearAll={onClearAll}
        className="relative z-10"
      />

      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 relative z-10 flex-1">
        
        {/* Left Columns (3/4 width) */}
        <div className="lg:col-span-3 min-w-0 flex flex-col gap-6">
          {/* Recent Campaigns */}
          <CampaignGrid
            campaigns={campaigns}
            onPlay={onPlayCampaign}
            onEdit={onEditCampaign}
            onDelete={onDeleteCampaign}
            onCreateCampaign={onCreateCampaign}
            loading={loading}
          />

          {/* Recent Characters */}
          <CharacterGrid
            characters={characters}
            onStartSession={onStartCharacterSession}
            onEdit={onEditCharacter}
            onDelete={onDeleteCharacter}
            onCreateCharacter={onCreateCharacter}
            loading={loading}
          />

          {/* Dice Roller Component */}
          <DiceRoller className="mt-2" />
        </div>

        {/* Right Column (1/4 width) */}
        <div className="lg:col-span-1 min-w-0">
          <DocumentSidebar />
        </div>
      </div>

      {/* Glowing Ember Particle Container at the bottom */}
      <div className="absolute inset-x-0 bottom-0 h-64 pointer-events-none overflow-hidden select-none z-0">
        <div className="absolute bottom-0 inset-x-0 h-10 bg-gradient-to-t from-orange-600/10 to-transparent blur-md" />
        {embers.map((ember) => (
          <div
            key={ember.id}
            className="absolute bottom-0 rounded-full bg-orange-500 blur-[0.5px] opacity-0"
            style={{
              left: `${ember.left}%`,
              width: `${ember.size}px`,
              height: `${ember.size}px`,
              animation: `floatUp ${ember.duration}s ease-in-out infinite`,
              animationDelay: `${ember.delay}s`,
              boxShadow: '0 0 8px #d97706, 0 0 12px #ea580c',
            }}
          />
        ))}
      </div>

      {/* Style element for keyframe animations */}
      <style>{`
        @keyframes floatUp {
          0% {
            transform: translateY(10px) translateX(0) scale(1);
            opacity: 0;
          }
          10% {
            opacity: 0.8;
          }
          50% {
            opacity: 0.6;
            transform: translateY(-100px) translateX(15px) scale(0.8);
          }
          90% {
            opacity: 0.2;
          }
          100% {
            transform: translateY(-220px) translateX(-10px) scale(0.4);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
};
