import Check from 'lucide-react/dist/esm/icons/check';
import Copy from 'lucide-react/dist/esm/icons/copy';
import Download from 'lucide-react/dist/esm/icons/download';
import Printer from 'lucide-react/dist/esm/icons/printer';
import Scroll from 'lucide-react/dist/esm/icons/scroll';
import X from 'lucide-react/dist/esm/icons/x';
import { useEffect, useId, useMemo, useState } from 'react';

import type { CampaignFixtureBundle, CampaignSession } from '@/demo/fixture-registry';
import {
  generateRunSheetHtml,
  generateRunSheetMarkdown,
  type RunSheetExportOptions,
} from './runSheetExport';
import styles from './RunSheetExportModal.module.css';

export interface RunSheetExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  session: CampaignSession;
  bundle: CampaignFixtureBundle;
}

export function RunSheetExportModal({
  isOpen,
  onClose,
  session,
  bundle,
}: RunSheetExportModalProps) {
  const titleId = useId();
  const [viewTab, setViewTab] = useState<'rendered' | 'markdown'>('rendered');
  const [copied, setCopied] = useState(false);

  const [options, setOptions] = useState<RunSheetExportOptions>({
    includeDmOnlyNotes: true,
    includeCombatDetails: true,
    includeLoot: true,
    includeSecrets: true,
    includeHandouts: true,
  });

  // Handle ESC key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const markdown = useMemo(
    () => generateRunSheetMarkdown(session, bundle, options),
    [session, bundle, options],
  );

  const html = useMemo(
    () => generateRunSheetHtml(session, bundle, options),
    [session, bundle, options],
  );

  if (!isOpen) return null;

  const handleCopyMarkdown = async () => {
    try {
      await navigator.clipboard.writeText(markdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      setCopied(false);
    }
  };

  const handleDownloadMarkdown = () => {
    const slug = session.title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const filename = `session-${session.number}-${slug}-run-sheet.md`;
    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      window.print();
      return;
    }
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  };

  return (
    <div
      className={styles.overlay}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <div className={styles.modal}>
        <div className={styles.header}>
          <div className={styles.titleArea}>
            <Scroll className={styles.titleIcon} size={20} />
            <h2 id={titleId} className={styles.title}>
              Session Run Sheet Export
            </h2>
          </div>
          <button
            aria-label="Close export modal"
            className={styles.closeBtn}
            onClick={onClose}
            type="button"
          >
            <X size={18} />
          </button>
        </div>

        <div className={styles.controlsBar}>
          <div className={styles.toggles}>
            <label className={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={options.includeDmOnlyNotes}
                onChange={(e) =>
                  setOptions({ ...options, includeDmOnlyNotes: e.target.checked })
                }
              />
              DM Notes
            </label>
            <label className={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={options.includeCombatDetails}
                onChange={(e) =>
                  setOptions({
                    ...options,
                    includeCombatDetails: e.target.checked,
                  })
                }
              />
              Encounters & Traps
            </label>
            <label className={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={options.includeLoot}
                onChange={(e) =>
                  setOptions({ ...options, includeLoot: e.target.checked })
                }
              />
              Scheduled Loot
            </label>
            <label className={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={options.includeSecrets}
                onChange={(e) =>
                  setOptions({ ...options, includeSecrets: e.target.checked })
                }
              />
              Secrets & Clues
            </label>
            <label className={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={options.includeHandouts}
                onChange={(e) =>
                  setOptions({ ...options, includeHandouts: e.target.checked })
                }
              />
              Handouts
            </label>
          </div>

          <div className={styles.viewTabs}>
            <button
              type="button"
              className={`${styles.viewTab} ${viewTab === 'rendered' ? styles.viewTabActive : ''}`}
              onClick={() => setViewTab('rendered')}
            >
              Print Preview
            </button>
            <button
              type="button"
              className={`${styles.viewTab} ${viewTab === 'markdown' ? styles.viewTabActive : ''}`}
              onClick={() => setViewTab('markdown')}
            >
              Markdown
            </button>
          </div>
        </div>

        <div className={styles.previewContainer}>
          {viewTab === 'markdown' ? (
            <pre className={styles.markdownPreview} data-testid="markdown-preview">
              {markdown}
            </pre>
          ) : (
            <div
              className={styles.renderedPreview}
              data-testid="rendered-preview"
              dangerouslySetInnerHTML={{
                __html: html
                  .replace(/<!DOCTYPE html>[\s\S]*?<body>/, '')
                  .replace(/<\/body>[\s\S]*?<\/html>/, ''),
              }}
            />
          )}
        </div>

        <div className={styles.footer}>
          <button
            className={styles.actionBtn}
            onClick={handleCopyMarkdown}
            type="button"
          >
            {copied ? <Check size={16} /> : <Copy size={16} />}
            <span>{copied ? 'Copied!' : 'Copy Markdown'}</span>
          </button>

          <button
            className={styles.actionBtn}
            onClick={handleDownloadMarkdown}
            type="button"
          >
            <Download size={16} />
            <span>Download .md</span>
          </button>

          <button
            className={`${styles.actionBtn} ${styles.primaryActionBtn}`}
            onClick={handlePrint}
            type="button"
          >
            <Printer size={16} />
            <span>Print / PDF</span>
          </button>
        </div>
      </div>
    </div>
  );
}
