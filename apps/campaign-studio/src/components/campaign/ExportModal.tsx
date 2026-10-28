import { useState } from 'react';
import { Download, CheckCircle } from 'lucide-react';
import { useCampaigns } from '@/hooks/useCampaigns';
import { exportService } from '@/services/export.service';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';

interface ExportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaignId?: string;
}

export function ExportModal({ open, onOpenChange, campaignId: propCampaignId }: ExportModalProps) {
  const { campaigns } = useCampaigns();
  const [selectedCampaignId, setSelectedCampaignId] = useState(propCampaignId || '');
  const [filename, setFilename] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);

  const handleExport = async () => {
    if (!selectedCampaignId) {
      alert('Please select a campaign to export');
      return;
    }

    setIsExporting(true);
    setExportSuccess(false);

    try {
      await exportService.downloadCampaignJSON(selectedCampaignId, filename || undefined);
      setExportSuccess(true);

      // Close modal after 2 seconds
      setTimeout(() => {
        onOpenChange(false);
        setExportSuccess(false);
        setFilename('');
      }, 2000);
    } catch (error) {
      console.error('Export failed:', error);
      alert(`Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsExporting(false);
    }
  };

  const selectedCampaign = campaigns?.find(c => c.id === selectedCampaignId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onClose={() => onOpenChange(false)}>
        <DialogHeader>
          <DialogTitle>Export Campaign</DialogTitle>
          <DialogDescription>
            Download your campaign as a JSON file for backup or sharing
          </DialogDescription>
        </DialogHeader>

        {exportSuccess ? (
          <div className="flex flex-col items-center justify-center py-8">
            <CheckCircle className="mb-4 h-16 w-16 text-green-500" />
            <p className="text-lg font-semibold">Campaign exported successfully!</p>
            <p className="text-sm text-muted-foreground">Check your downloads folder</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Campaign Selection */}
            {!propCampaignId && (
              <div className="space-y-2">
                <Label htmlFor="campaign">Campaign</Label>
                <Select
                  id="campaign"
                  value={selectedCampaignId}
                  onChange={(e) => setSelectedCampaignId(e.target.value)}
                >
                  <option value="">Select a campaign...</option>
                  {campaigns?.map((campaign) => (
                    <option key={campaign.id} value={campaign.id}>
                      {campaign.name} ({campaign.gameSystem})
                    </option>
                  ))}
                </Select>
              </div>
            )}

            {/* Campaign Info */}
            {selectedCampaign && (
              <div className="rounded-lg border bg-muted p-4">
                <h3 className="font-semibold">{selectedCampaign.name}</h3>
                <p className="text-sm text-muted-foreground">{selectedCampaign.gameSystem}</p>
                <p className="mt-2 text-xs text-muted-foreground capitalize">
                  Status: {selectedCampaign.status}
                </p>
              </div>
            )}

            {/* Filename */}
            <div className="space-y-2">
              <Label htmlFor="filename">Filename (optional)</Label>
              <Input
                id="filename"
                placeholder="my-campaign-backup.json"
                value={filename}
                onChange={(e) => setFilename(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Leave empty to auto-generate filename
              </p>
            </div>

            {/* Info */}
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950">
              <p className="text-sm text-blue-900 dark:text-blue-100">
                <strong>What's included:</strong> All campaign data (worlds, sessions, NPCs,
                encounters, notes, journals, lore, and codex links)
              </p>
            </div>
          </div>
        )}

        {!exportSuccess && (
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isExporting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleExport}
              disabled={!selectedCampaignId || isExporting}
            >
              {isExporting ? (
                'Exporting...'
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" />
                  Export
                </>
              )}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
