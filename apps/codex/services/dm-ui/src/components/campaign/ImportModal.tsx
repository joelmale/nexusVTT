import { useState, useRef } from 'react';
import { Upload, CheckCircle, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { exportService, CampaignExport } from '@/services/export.service';
import { useCampaignStore } from '@/stores/campaignStore';
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

interface ImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type ImportStep = 'select' | 'preview' | 'importing' | 'success' | 'error';

export function ImportModal({ open, onOpenChange }: ImportModalProps) {
  const navigate = useNavigate();
  const { setActiveCampaign } = useCampaignStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<ImportStep>('select');
  const [importData, setImportData] = useState<CampaignExport | null>(null);
  const [importAsNew, setImportAsNew] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text) as CampaignExport;

      // Validate
      const validation = exportService.validateExport(data);
      if (!validation.valid) {
        setErrorMessage(validation.errors.join(', '));
        setStep('error');
        return;
      }

      setImportData(data);
      setStep('preview');
    } catch (error) {
      setErrorMessage(
        `Invalid JSON file: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      setStep('error');
    }
  };

  const handleImport = async () => {
    if (!importData) return;

    setStep('importing');

    try {
      const campaignId = await exportService.importCampaign(importData, {
        newCampaignId: importAsNew,
        overwrite: !importAsNew
      });

      setStep('success');

      // Set as active campaign and navigate after 2 seconds
      setTimeout(async () => {
        // Reload campaign from DB to get fresh data
        const { db } = await import('@/db/schema');
        const campaign = await db.campaigns.get(campaignId);
        if (campaign) {
          setActiveCampaign(campaign);
          navigate(`/campaigns/${campaignId}`);
        }
        onOpenChange(false);
        resetState();
      }, 2000);
    } catch (error) {
      setErrorMessage(
        `Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      setStep('error');
    }
  };

  const resetState = () => {
    setStep('select');
    setImportData(null);
    setImportAsNew(true);
    setErrorMessage('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    setTimeout(resetState, 300); // Reset after dialog closes
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onClose={handleClose}>
        <DialogHeader>
          <DialogTitle>Import Campaign</DialogTitle>
          <DialogDescription>
            Restore a campaign from a JSON backup file
          </DialogDescription>
        </DialogHeader>

        {/* Step: Select File */}
        {step === 'select' && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="file">Campaign JSON File</Label>
              <input
                ref={fileInputRef}
                id="file"
                type="file"
                accept=".json,application/json"
                onChange={handleFileSelect}
                className="w-full"
              />
            </div>

            <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 dark:border-yellow-800 dark:bg-yellow-950">
              <p className="text-sm text-yellow-900 dark:text-yellow-100">
                <strong>Note:</strong> Make sure to select a valid NexusCodex campaign export file
                (JSON format, version 1.0.0)
              </p>
            </div>
          </div>
        )}

        {/* Step: Preview */}
        {step === 'preview' && importData && (
          <div className="space-y-4">
            <div className="rounded-lg border bg-muted p-4">
              <h3 className="font-semibold">{importData.campaign.name}</h3>
              <p className="text-sm text-muted-foreground">{importData.campaign.gameSystem}</p>
              <p className="mt-2 text-xs text-muted-foreground">
                Exported: {new Date(importData.exportedAt).toLocaleDateString()}
              </p>
            </div>

            <div className="space-y-2">
              <h4 className="font-semibold">What will be imported:</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• {importData.metadata.totalSessions} sessions</li>
                <li>• {importData.metadata.totalNPCs} NPCs</li>
                <li>• {importData.metadata.totalPlotThreads} plot threads</li>
                <li>• {importData.metadata.totalEncounters} encounters</li>
                <li>• {importData.metadata.totalNotes} notes</li>
                <li>• {importData.metadata.totalWorlds} worlds/locations</li>
              </ul>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={importAsNew}
                  onChange={(e) => setImportAsNew(e.target.checked)}
                  className="h-4 w-4"
                />
                Import as new campaign (generate new ID)
              </Label>
              <p className="text-xs text-muted-foreground">
                {importAsNew
                  ? 'Will create a new campaign with a unique ID'
                  : 'Will overwrite existing campaign if ID matches (use with caution!)'}
              </p>
            </div>
          </div>
        )}

        {/* Step: Importing */}
        {step === 'importing' && (
          <div className="flex flex-col items-center justify-center py-8">
            <div className="mb-4 h-16 w-16 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <p className="text-lg font-semibold">Importing campaign...</p>
            <p className="text-sm text-muted-foreground">This may take a few seconds</p>
          </div>
        )}

        {/* Step: Success */}
        {step === 'success' && (
          <div className="flex flex-col items-center justify-center py-8">
            <CheckCircle className="mb-4 h-16 w-16 text-green-500" />
            <p className="text-lg font-semibold">Campaign imported successfully!</p>
            <p className="text-sm text-muted-foreground">Redirecting to campaign...</p>
          </div>
        )}

        {/* Step: Error */}
        {step === 'error' && (
          <div className="space-y-4">
            <div className="flex flex-col items-center justify-center py-8">
              <AlertCircle className="mb-4 h-16 w-16 text-destructive" />
              <p className="text-lg font-semibold">Import failed</p>
            </div>

            <div className="rounded-lg border border-destructive bg-destructive/10 p-4">
              <p className="text-sm text-destructive">{errorMessage}</p>
            </div>
          </div>
        )}

        {/* Footer */}
        {(step === 'select' || step === 'preview' || step === 'error') && (
          <DialogFooter>
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            {step === 'preview' && (
              <Button onClick={handleImport}>
                <Upload className="mr-2 h-4 w-4" />
                Import Campaign
              </Button>
            )}
            {step === 'error' && (
              <Button onClick={resetState}>Try Again</Button>
            )}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
