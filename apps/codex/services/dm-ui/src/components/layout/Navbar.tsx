import { useState } from 'react';
import { Menu, Download, Upload, Book } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useCampaignStore } from '@/stores/campaignStore';
import { ExportModal } from '@/components/campaign/ExportModal';
import { ImportModal } from '@/components/campaign/ImportModal';

interface NavbarProps {
  onMenuClick: () => void;
}

export function Navbar({ onMenuClick }: NavbarProps) {
  const { activeCampaign } = useCampaignStore();
  const [showExportModal, setShowExportModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);

  return (
    <>
      <nav className="border-b bg-card px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Left: Menu + Logo */}
          <div className="flex items-center gap-4">
            <button
              onClick={onMenuClick}
              className="rounded-md p-2 hover:bg-accent"
              aria-label="Toggle sidebar"
            >
              <Menu className="h-5 w-5" />
            </button>

            <Link to="/" className="flex items-center gap-2">
              <Book className="h-6 w-6 text-primary" />
              <div>
                <h1 className="text-lg font-bold">NexusCodex</h1>
                <p className="text-xs text-muted-foreground">DM Campaign Planner</p>
              </div>
            </Link>
          </div>

          {/* Center: Active Campaign */}
          {activeCampaign && (
            <div className="flex-1 text-center">
              <p className="text-sm text-muted-foreground">Active Campaign</p>
              <p className="font-semibold">{activeCampaign.name}</p>
            </div>
          )}

          {/* Right: Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowImportModal(true)}
              className="rounded-md p-2 hover:bg-accent"
              title="Import Campaign"
            >
              <Upload className="h-5 w-5" />
            </button>
            <button
              onClick={() => setShowExportModal(true)}
              className="rounded-md p-2 hover:bg-accent disabled:opacity-50"
              title="Export Campaign"
              disabled={!activeCampaign}
            >
              <Download className="h-5 w-5" />
            </button>
          </div>
        </div>
      </nav>

      {/* Modals */}
      <ExportModal
        open={showExportModal}
        onOpenChange={setShowExportModal}
        campaignId={activeCampaign?.id}
      />

      <ImportModal
        open={showImportModal}
        onOpenChange={setShowImportModal}
      />
    </>
  );
}
