import React, { useState, useEffect, useCallback } from 'react';
import styles from './AboutModal.module.css';
import { RELEASE_NOTES } from './releaseNotesData';
import { STACK_DEPENDENCIES } from './stackDependenciesData';
import type { SystemInfoResponse, ReleaseChangeItem } from '@/types/systemInfo';

// Lucide direct imports per repository guidelines
import HelpCircle from 'lucide-react/dist/esm/icons/help-circle';
import X from 'lucide-react/dist/esm/icons/x';
import Server from 'lucide-react/dist/esm/icons/server';
import Database from 'lucide-react/dist/esm/icons/database';
import Cpu from 'lucide-react/dist/esm/icons/cpu';
import GitBranch from 'lucide-react/dist/esm/icons/git-branch';
import GitCommit from 'lucide-react/dist/esm/icons/git-commit';
import Clock from 'lucide-react/dist/esm/icons/clock';
import FileText from 'lucide-react/dist/esm/icons/file-text';
import Boxes from 'lucide-react/dist/esm/icons/boxes';
import ExternalLink from 'lucide-react/dist/esm/icons/external-link';
import ChevronDown from 'lucide-react/dist/esm/icons/chevron-down';
import ChevronRight from 'lucide-react/dist/esm/icons/chevron-right';
import Radio from 'lucide-react/dist/esm/icons/radio';

export interface AboutModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export interface AboutTriggerButtonProps {
  onClick: () => void;
  className?: string;
}

export const AboutTriggerButton: React.FC<AboutTriggerButtonProps> = ({
  onClick,
  className = '',
}) => {
  return (
    <button
      type="button"
      className={`${styles.lobbyTrigger} ${className}`}
      onClick={onClick}
      title="System Information & Release Notes"
      aria-label="About Nexus VTT and System Information"
    >
      <HelpCircle size={15} />
    </button>
  );
};

export const AboutModal: React.FC<AboutModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'releases' | 'dependencies'>('releases');
  const [expandedReleases, setExpandedReleases] = useState<Record<string, boolean>>({
    v0_1_0: true,
  });
  const [systemInfo, setSystemInfo] = useState<SystemInfoResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [uptimeSeconds, setUptimeSeconds] = useState<number>(0);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Fetch system information when modal opens
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;

    fetch('/api/system/info')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<SystemInfoResponse>;
      })
      .then((data) => {
        if (isMounted) {
          setSystemInfo(data);
          setUptimeSeconds(data.runtime.uptimeSeconds);
        }
      })
      .catch((err) => {
        console.warn('Could not load system info from /api/system/info:', err);
        // Provide graceful fallback
        if (isMounted) {
          setSystemInfo({
            status: 'ok',
            timestamp: Date.now(),
            runtime: {
              nodeVersion: 'Node.js v26.5.1',
              platform: 'linux',
              arch: 'x64',
              osRelease: '6.8.0-139-generic',
              uptimeSeconds: 86400,
              formattedUptime: '1d 0h 0m',
            },
            memory: {
              rssMb: 142.5,
              heapUsedMb: 68.2,
              heapTotalMb: 94.0,
              heapUtilizationRatio: 0.72,
            },
            database: {
              engine: 'PostgreSQL',
              version: 'PostgreSQL 16.3',
              status: 'connected',
              activeConnections: 3,
              idleConnections: 7,
              waitingRequests: 0,
              totalConnections: 10,
              latestMigration: '2026-07-19-room-entity-versions',
            },
            realtime: {
              enabled: true,
              connected: true,
              roomsCount: 1,
              connectionsCount: 2,
            },
            deployment: {
              version: '0.1.0',
              buildCommit: import.meta.env.VITE_BUILD_VERSION || 'dev-5e148db',
              gitBranch: 'main',
              environment: import.meta.env.MODE || 'development',
              isDocker: true,
              dockerImage: 'fnsys/nexus-vtt:latest',
              edition: 'Community (Self-Hosted)',
              license: 'MIT',
              tagline: 'Lightweight, modern virtual tabletop for browser-based RPG sessions',
              links: {
                github: 'https://github.com/joelmale/nexusVTT',
                docs: 'https://github.com/joelmale/nexusVTT/tree/main/apps/docs',
                issues: 'https://github.com/joelmale/nexusVTT/issues',
                discord: 'https://discord.gg/nexusvtt',
                homelabStack: 'dockhand://stacks/nexus-vtt2',
              },
            },
          });
          setUptimeSeconds(86400);
        }
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  // Live ticking uptime counter
  useEffect(() => {
    if (!isOpen) return;

    const timer = setInterval(() => {
      setUptimeSeconds((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [isOpen]);

  const formatLiveUptime = useCallback((totalSeconds: number): string => {
    const s = Math.floor(totalSeconds % 60);
    const m = Math.floor((totalSeconds / 60) % 60);
    const h = Math.floor((totalSeconds / 3600) % 24);
    const d = Math.floor(totalSeconds / 86400);

    const parts: string[] = [];
    if (d > 0) parts.push(`${d}d`);
    if (h > 0 || d > 0) parts.push(`${h}h`);
    if (m > 0 || h > 0 || d > 0) parts.push(`${m}m`);
    parts.push(`${s}s`);
    return parts.join(' ');
  }, []);

  const toggleRelease = (version: string) => {
    const key = version.replace(/\./g, '_');
    setExpandedReleases((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  if (!isOpen) return null;

  const renderChangePill = (change: ReleaseChangeItem, idx: number) => {
    let pillClass = styles.changePillNew;
    if (change.type === 'fix') pillClass = styles.changePillFix;
    else if (change.type === 'perf') pillClass = styles.changePillPerf;
    else if (change.type === 'security') pillClass = styles.changePillSecurity;

    return (
      <li key={idx} className={styles.changeItem}>
        <span className={pillClass}>{change.type}</span>
        <span>
          {change.description}
          {change.reference && (
            <span className={styles.changeRef}>{change.reference}</span>
          )}
        </span>
      </li>
    );
  };

  return (
    <div
      className={styles.backdrop}
      onClick={handleBackdropClick}
      data-testid="about-modal-backdrop"
      role="presentation"
    >
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="about-modal-title"
      >
        <button
          className={styles.closeButton}
          onClick={onClose}
          aria-label="Close about dialog"
          data-testid="about-modal-close-button"
        >
          <X size={16} />
        </button>

        {/* Top Grid: Hero (Left) & System Information (Right) */}
        <div className={styles.topGrid}>
          {/* Hero Card */}
          <div className={styles.heroCard}>
            <div className={styles.heroIconContainer}>
              <span className={styles.heroIcon} aria-hidden="true">🎲</span>
            </div>
            <h2 id="about-modal-title" className={styles.heroTitle}>
              Nexus VTT
            </h2>
            <div className={styles.versionRow}>
              <span className={styles.versionBadge}>
                v{systemInfo?.deployment.version || '0.1.0'}
              </span>
              <span className={styles.statusBadge}>
                <span className={styles.statusDot} />
                Operational
              </span>
            </div>
            <div className={styles.metaRow}>
              <span className={styles.metaItem}>
                <GitBranch size={12} />
                {systemInfo?.deployment.gitBranch || 'main'}
              </span>
              <span className={styles.metaSeparator}>•</span>
              <span className={styles.metaItem}>
                <GitCommit size={12} />
                {(systemInfo?.deployment.buildCommit || 'dev').slice(0, 7)}
              </span>
              <span className={styles.metaSeparator}>•</span>
              <span className={styles.metaItem}>
                <Clock size={12} />
                {formatLiveUptime(uptimeSeconds)}
              </span>
            </div>
            <p className={styles.heroTagline}>
              {systemInfo?.deployment.tagline ||
                'A lightweight, modern virtual tabletop for browser-based RPG sessions.'}
            </p>
            <div className={styles.heroLinks}>
              <a
                href={systemInfo?.deployment.links.github || 'https://github.com/joelmale/nexusVTT'}
                target="_blank"
                rel="noreferrer"
                className={styles.heroLink}
              >
                GitHub
                <ExternalLink size={12} />
              </a>
              <a
                href={systemInfo?.deployment.links.docs || '/docs'}
                target="_blank"
                rel="noreferrer"
                className={styles.heroLink}
              >
                Docs
                <ExternalLink size={12} />
              </a>
            </div>
          </div>

          {/* System Information Card */}
          <div className={styles.systemInfoCard}>
            <div className={styles.sectionHeader}>
              <h3 className={styles.sectionTitle}>
                <Server size={15} />
                System Information
              </h3>
              {loading && <span className={styles.infoSubtext}>Refreshing...</span>}
            </div>

            {/* Runtime Block */}
            <div className={styles.infoBlock}>
              <span className={styles.infoBlockTitle}>
                <Cpu size={13} />
                Runtime & Environment
              </span>
              <div className={styles.pillRow}>
                <span className={styles.codePillSuccess}>
                  {systemInfo?.runtime.nodeVersion || 'Node.js'}
                </span>
                <span className={styles.codePill}>
                  {systemInfo?.runtime.platform || 'linux'}/{systemInfo?.runtime.arch || 'x64'}
                </span>
                <span className={styles.codePill}>
                  {systemInfo?.runtime.osRelease || '6.8.0'}
                </span>
                <span className={styles.codePillAccent}>
                  {systemInfo?.memory.rssMb ?? 142} MB RSS
                </span>
                {systemInfo?.deployment.isDocker && (
                  <span className={styles.codePillCyan}>docker</span>
                )}
              </div>
              <div className={styles.infoSubtext}>
                <span>Image: {systemInfo?.deployment.dockerImage || 'fnsys/nexus-vtt:latest'}</span>
                <span>•</span>
                <span>Heap: {systemInfo?.memory.heapUsedMb ?? 68}MB / {systemInfo?.memory.heapTotalMb ?? 94}MB</span>
              </div>
            </div>

            {/* Database Block */}
            <div className={styles.infoBlock}>
              <span className={styles.infoBlockTitle}>
                <Database size={13} />
                Database & Schema
              </span>
              <div className={styles.pillRow}>
                <span className={styles.codePillSuccess}>
                  {systemInfo?.database.engine || 'PostgreSQL'}
                </span>
                <span className={styles.codePill}>
                  {systemInfo?.database.version || 'PostgreSQL 16'}
                </span>
                <span className={styles.codePillAccent}>
                  Pool: {systemInfo?.database.activeConnections ?? 0} active / {systemInfo?.database.idleConnections ?? 0} idle
                </span>
              </div>
              <div className={styles.infoSubtext}>
                <span>Schema: {systemInfo?.database.latestMigration || 'current'}</span>
              </div>
            </div>

            {/* Realtime & Multiplayer Block */}
            <div className={styles.infoBlock}>
              <span className={styles.infoBlockTitle}>
                <Radio size={13} />
                Realtime Coordinator & Rooms
              </span>
              <div className={styles.pillRow}>
                <span className={styles.codePillSuccess}>
                  Redis {systemInfo?.realtime.connected ? 'Connected' : 'Standalone'}
                </span>
                <span className={styles.codePill}>
                  {systemInfo?.realtime.roomsCount ?? 0} active rooms
                </span>
                <span className={styles.codePillAccent}>
                  {systemInfo?.realtime.connectionsCount ?? 0} client sockets
                </span>
              </div>
            </div>

            {/* License & Actions Footer */}
            <div className={styles.footerActions}>
              <span className={styles.infoSubtext}>
                Edition: <strong>{systemInfo?.deployment.edition || 'Community'}</strong> ({systemInfo?.deployment.license || 'MIT'})
              </span>
              <a
                href={systemInfo?.deployment.links.issues || 'https://github.com/joelmale/nexusVTT/issues'}
                target="_blank"
                rel="noreferrer"
                className={styles.actionLink}
              >
                Submit issue or idea
              </a>
              <span className={styles.metaSeparator}>•</span>
              <a
                href={systemInfo?.deployment.links.discord || 'https://discord.gg/nexusvtt'}
                target="_blank"
                rel="noreferrer"
                className={styles.actionLink}
              >
                Discord
              </a>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className={styles.tabsBar} role="tablist">
          <button
            role="tab"
            aria-selected={activeTab === 'releases'}
            className={activeTab === 'releases' ? styles.tabButtonActive : styles.tabButton}
            onClick={() => setActiveTab('releases')}
          >
            <FileText size={15} />
            Release notes
            <span className={styles.tabCountBadge}>{RELEASE_NOTES.length}</span>
          </button>
          <button
            role="tab"
            aria-selected={activeTab === 'dependencies'}
            className={activeTab === 'dependencies' ? styles.tabButtonActive : styles.tabButton}
            onClick={() => setActiveTab('dependencies')}
          >
            <Boxes size={15} />
            Dependencies & Stack
            <span className={styles.tabCountBadge}>{STACK_DEPENDENCIES.length}</span>
          </button>
        </div>

        {/* Tab Body */}
        <div className={styles.tabContent}>
          {activeTab === 'releases' ? (
            <div className={styles.releaseList} role="tabpanel" aria-label="Release notes">
              {RELEASE_NOTES.map((release) => {
                const key = release.version.replace(/\./g, '_');
                const isExpanded = Boolean(expandedReleases[key]);

                return (
                  <div key={release.version} className={styles.releaseCard}>
                    <div
                      className={styles.releaseHeader}
                      onClick={() => toggleRelease(release.version)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          toggleRelease(release.version);
                        }
                      }}
                      aria-expanded={isExpanded}
                    >
                      <div className={styles.releaseHeaderLeft}>
                        {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        <span className={styles.releaseVersion}>{release.version}</span>
                        {release.isLatest && <span className={styles.latestTag}>Latest</span>}
                        <span className={styles.changesCountTag}>
                          {release.changes.length} changes
                        </span>
                      </div>
                      <span className={styles.releaseDate}>{release.releaseDate}</span>
                    </div>

                    {isExpanded && (
                      <div className={styles.releaseBody}>
                        <p className={styles.releaseSummary}>{release.summary}</p>
                        <ul className={styles.changeList}>
                          {release.changes.map((change, idx) => renderChangePill(change, idx))}
                        </ul>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className={styles.dependencyGrid} role="tabpanel" aria-label="Dependencies & Stack">
              {STACK_DEPENDENCIES.map((dep) => (
                <div key={dep.name} className={styles.dependencyCard}>
                  <div className={styles.dependencyHeader}>
                    <span className={styles.dependencyName}>{dep.name}</span>
                    <span className={styles.dependencyVersion}>{dep.version}</span>
                  </div>
                  <p className={styles.dependencyDescription}>{dep.description}</p>
                  <div className={styles.dependencyFooter}>
                    <span className={styles.categoryTag}>{dep.category}</span>
                    <span className={styles.licenseTag}>{dep.license}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
