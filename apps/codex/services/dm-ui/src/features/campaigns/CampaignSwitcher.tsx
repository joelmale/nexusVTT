import { useEffect, useId, useRef, useState } from 'react';
import Check from 'lucide-react/dist/esm/icons/check';
import ChevronDown from 'lucide-react/dist/esm/icons/chevron-down';
import Plus from 'lucide-react/dist/esm/icons/plus';
import { useLocation, useNavigate } from 'react-router-dom';

import { getVisibleCampaignCatalog } from '@/demo/campaign-catalog';

import { useCampaignContext } from './CampaignContext';
import { CreateCampaignDialog } from './CreateCampaignDialog';
import styles from './CampaignSwitcher.module.css';

interface CampaignSwitcherProps {
  compact?: boolean;
}

function campaignMetadata(description: string | null, updatedAt: string) {
  if (description) return description;
  const timestamp = Date.parse(updatedAt);
  return Number.isNaN(timestamp)
    ? 'Server campaign'
    : `Updated ${new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(timestamp)}`;
}

export function CampaignSwitcher({ compact = false }: CampaignSwitcherProps) {
  const {
    activeCampaign,
    campaigns,
    error,
    isDemoCampaign,
    reload,
    rememberCampaign,
    state,
  } = useCampaignContext();
  const location = useLocation();
  const navigate = useNavigate();
  const popoverId = `campaign-switcher-${useId().replace(/:/g, '')}`;
  const popoverRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closedAtRef = useRef(0);
  const [open, setOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const exampleCampaigns = getVisibleCampaignCatalog();
  const activeExample = exampleCampaigns.find((entry) =>
    location.pathname.startsWith(`/demo/${entry.slug}/`),
  );

  useEffect(() => {
    const popover = popoverRef.current;
    if (!popover || typeof popover.showPopover !== 'function') return;
    if (open && !popover.matches(':popover-open')) popover.showPopover();
    if (!open && popover.matches(':popover-open')) popover.hidePopover();
  }, [open]);

  function closePopover() {
    setOpen(false);
  }

  function selectCampaign(campaignId: string) {
    rememberCampaign(campaignId);
    closePopover();
    navigate(`/campaigns/${encodeURIComponent(campaignId)}/overview`);
  }

  const label = isDemoCampaign
    ? (activeExample?.campaign.name ?? 'Example campaign')
    : (activeCampaign?.name ??
      (state === 'loading' ? 'Loading campaigns…' : 'Select campaign'));

  return (
    <div className={`${styles.switcher} ${compact ? styles.compact : ''}`}>
      <button
        aria-expanded={open}
        aria-haspopup="menu"
        className={styles.trigger}
        disabled={state === 'loading'}
        onClick={() => {
          // Light-dismiss already closed the popover on pointerdown; don't reopen it.
          if (open || Date.now() - closedAtRef.current < 150) return;
          setOpen(true);
        }}
        ref={triggerRef}
        style={{ anchorName: `--${popoverId}` }}
        type="button"
      >
        <span className={styles.label}>{label}</span>
        <ChevronDown aria-hidden="true" size={15} />
      </button>

      <div
        className={styles.popover}
        hidden={!open}
        id={popoverId}
        onToggle={(event) => {
          if (event.currentTarget.matches(':popover-open')) setOpen(true);
          else {
            closedAtRef.current = Date.now();
            setOpen(false);
          }
        }}
        popover="auto"
        ref={popoverRef}
        style={{ positionAnchor: `--${popoverId}` }}
      >
        <div aria-label="Campaigns" className={styles.menu} role="menu">
          <span className={styles.sectionLabel}>Examples</span>
          {exampleCampaigns.map((entry) => {
            const selected = activeExample?.slug === entry.slug;
            return (
              <button
                aria-checked={selected}
                className={styles.option}
                key={entry.slug}
                onClick={() => {
                  closePopover();
                  navigate(`/demo/${entry.slug}/overview`);
                }}
                role="menuitemradio"
                type="button"
              >
                <span>
                  <strong>{entry.campaign.name}</strong>
                  <small>
                    {entry.showcaseSessions.length} session
                    {entry.showcaseSessions.length === 1 ? '' : 's'} ·{' '}
                    {entry.lifecycle}
                  </small>
                </span>
                {selected && <Check aria-hidden="true" size={16} />}
              </button>
            );
          })}

          <div className={styles.divider} />
          <span className={styles.sectionLabel}>Campaigns</span>

          {campaigns.map((campaign) => {
            const selected = activeCampaign?.id === campaign.id;
            return (
              <button
                aria-checked={selected}
                className={styles.option}
                key={campaign.id}
                onClick={() => selectCampaign(campaign.id)}
                role="menuitemradio"
                type="button"
              >
                <span>
                  <strong>{campaign.name}</strong>
                  <small>
                    {campaignMetadata(campaign.description, campaign.updatedAt)}
                  </small>
                </span>
                {selected && <Check aria-hidden="true" size={16} />}
              </button>
            );
          })}

          {state === 'ready' && campaigns.length === 0 && (
            <p className={styles.stateMessage}>No server campaigns yet.</p>
          )}
          {(state === 'error' || state === 'authentication-required') && (
            <div className={styles.error} role="status">
              <span>{error}</span>
              <button onClick={() => void reload()} type="button">
                Retry
              </button>
            </div>
          )}

          <div className={styles.divider} />
          <button
            className={styles.create}
            disabled={state === 'authentication-required'}
            onClick={() => {
              closePopover();
              setDialogOpen(true);
            }}
            role="menuitem"
            type="button"
          >
            <Plus aria-hidden="true" size={16} />
            Create campaign…
          </button>
        </div>
      </div>

      <CreateCampaignDialog
        onClose={() => setDialogOpen(false)}
        open={dialogOpen}
        returnFocusRef={triggerRef}
      />
    </div>
  );
}
