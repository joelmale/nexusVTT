import React, { useState } from 'react';
import { Button } from '../atoms/Button';
import { ModalShell } from './ModalShell';

interface NewCampaignModalProps {
  /**
   * Save the campaign (create, or update when `campaign` is given). Resolves on
   * success; rejects with the failure reason.
   */
  onCreate: (name: string, description: string) => Promise<void>;
  onClose: () => void;
  /** Existing campaign to rename; omit to create a new one. */
  campaign?: { name: string; description: string };
}

const inputClass = `
  w-full px-3 py-2 rounded-sm text-[#f1e6d3] placeholder:text-[#cbd5e1]/50
  bg-[#1c1e22] border border-[#8c6b4a]/40 outline-none
  focus:border-[#d97706] focus:shadow-vtt-amber-glow
  transition-all duration-200 text-sm mb-4
`;

export const NewCampaignModal: React.FC<NewCampaignModalProps> = ({
  onCreate,
  onClose,
  campaign,
}) => {
  const isEdit = Boolean(campaign);
  const [name, setName] = useState(campaign?.name ?? '');
  const [description, setDescription] = useState(campaign?.description ?? '');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Campaign name is required.');
      return;
    }
    setCreating(true);
    setError(null);
    try {
      await onCreate(trimmed, description.trim());
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : `Failed to ${isEdit ? 'save' : 'create'} campaign`,
      );
    } finally {
      setCreating(false);
    }
  };

  return (
    <ModalShell
      title={isEdit ? 'Rename Campaign' : 'New Campaign'}
      onClose={onClose}
    >
      <p className="text-xs text-[#cbd5e1]/80 mb-4 font-serif italic">
        {isEdit
          ? 'Update the name and summary your players see.'
          : 'Name your campaign to begin chronicling a new adventure.'}
      </p>

      <label
        htmlFor="new-campaign-name"
        className="block text-[11px] uppercase font-bold tracking-widest text-amber-500 mb-1"
      >
        Campaign Name
      </label>
      <input
        id="new-campaign-name"
        type="text"
        placeholder="The Lost Mine of Phandelver"
        value={name}
        maxLength={255}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && void submit()}
        className={inputClass}
        autoFocus
      />

      <label
        htmlFor="new-campaign-description"
        className="block text-[11px] uppercase font-bold tracking-widest text-amber-500 mb-1"
      >
        Description{' '}
        <span className="text-[#cbd5e1]/75 normal-case font-normal">
          (optional)
        </span>
      </label>
      <textarea
        id="new-campaign-description"
        placeholder="A short summary of the adventure ahead…"
        value={description}
        rows={3}
        onChange={(e) => setDescription(e.target.value)}
        className={`${inputClass} resize-none font-serif`}
      />

      {error && (
        <p role="alert" className="text-red-400 text-xs mb-4 font-medium">
          {error}
        </p>
      )}

      <div className="flex justify-end gap-3 border-t border-[#8c6b4a]/20 pt-3 mt-2">
        <Button
          variant="ghost"
          onClick={onClose}
          className="!text-[#cbd5e1]/75 hover:!text-[#f1e6d3]"
        >
          Cancel
        </Button>
        <Button
          variant="bronze"
          onClick={() => void submit()}
          disabled={creating || !name.trim()}
        >
          {creating
            ? isEdit
              ? 'Saving…'
              : 'Creating…'
            : isEdit
              ? 'Save Changes'
              : 'Create Campaign'}
        </Button>
      </div>
    </ModalShell>
  );
};
