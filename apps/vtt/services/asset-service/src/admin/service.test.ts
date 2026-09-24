import { afterEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { ADMIN_CONFIG_DEFAULTS, loadAdminConfig, type AdminConfig } from './config';
import { AssetMetrics } from './metrics';
import { AdminAssetService } from './service';

function makeService(config: Partial<AdminConfig>) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'asset-admin-service-'));
  const metrics = new AssetMetrics();
  const service = new AdminAssetService({
    libraryRoot: root,
    metrics,
    getConfig: () => ({ ...ADMIN_CONFIG_DEFAULTS, ...config }),
    reloadFromDisk: () => ({ ok: true }),
    publishIndex: () => undefined,
  });
  service.setBaseManifest({
    version: '1.0.0',
    generatedAt: '1970-01-01T00:00:00.000Z',
    totalAssets: 0,
    categories: [],
    assets: [],
  });
  return { root, metrics, service };
}

afterEach(() => {
  vi.useRealTimers();
});

describe('scheduled integrity reports', () => {
  it('does nothing when the interval is 0', () => {
    vi.useFakeTimers();
    const { root, service } = makeService({ integrityIntervalMs: 0 });
    const spy = vi.spyOn(service, 'startIntegrityReport');
    const stop = service.scheduleIntegrity();
    vi.advanceTimersByTime(24 * 60 * 60 * 1000);
    expect(spy).not.toHaveBeenCalled();
    stop();
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('runs on the configured interval as a system actor and updates metrics', async () => {
    vi.useFakeTimers();
    const { root, metrics, service } = makeService({
      integrityIntervalMs: 1000,
      integrityVerifyHashes: false,
    });
    const spy = vi.spyOn(service, 'startIntegrityReport');
    const stop = service.scheduleIntegrity();
    vi.advanceTimersByTime(1000);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][0].actor).toBe('system:integrity-schedule');
    expect(spy.mock.calls[0][1]).toBe(false);
    vi.advanceTimersByTime(1000);
    expect(spy).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
    await spy.mock.results[0].value.done;
    expect(service.getLatestIntegrityReport()?.counts.missingFiles).toBe(0);
    expect(metrics.render()).toMatch(/^asset_missing_files 0$/m);
    stop();
    fs.rmSync(root, { recursive: true, force: true });
  });
});

describe('loadAdminConfig', () => {
  const keys = [
    'ASSET_ADMIN_MAX_UPLOAD_BYTES',
    'ASSET_ADMIN_STORAGE_QUOTA_BYTES',
    'ASSET_INTEGRITY_INTERVAL_MS',
    'ASSET_INTEGRITY_VERIFY_HASHES',
  ];
  afterEach(() => {
    for (const key of keys) delete process.env[key];
  });

  it('defaults to a 25MB upload limit and a daily integrity report', () => {
    for (const key of keys) delete process.env[key];
    const config = loadAdminConfig();
    expect(config.maxUploadBytes).toBe(25 * 1024 * 1024);
    expect(config.integrityIntervalMs).toBe(24 * 60 * 60 * 1000);
    expect(config.integrityVerifyHashes).toBe(true);
  });

  it('reads overrides and ignores invalid values', () => {
    process.env.ASSET_ADMIN_MAX_UPLOAD_BYTES = '1024';
    process.env.ASSET_ADMIN_STORAGE_QUOTA_BYTES = '0';
    process.env.ASSET_INTEGRITY_INTERVAL_MS = 'soon';
    process.env.ASSET_INTEGRITY_VERIFY_HASHES = 'false';
    const config = loadAdminConfig();
    expect(config.maxUploadBytes).toBe(1024);
    expect(config.storageQuotaBytes).toBe(0);
    expect(config.integrityIntervalMs).toBe(ADMIN_CONFIG_DEFAULTS.integrityIntervalMs);
    expect(config.integrityVerifyHashes).toBe(false);
  });
});

describe('AssetMetrics', () => {
  it('omits manifest age while no index is loaded and escapes label values', () => {
    const metrics = new AssetMetrics();
    metrics.uploadRejections.inc('weird"reason\\x');
    const text = metrics.render();
    expect(text).toMatch(/^asset_manifest_loaded 0$/m);
    expect(text).not.toMatch(/^asset_manifest_age_seconds /m);
    expect(text).toContain('asset_upload_rejections_total{reason="weird\\"reason\\\\x"} 1');
    metrics.markManifestBuilt(1000);
    expect(metrics.render(11_000)).toMatch(/^asset_manifest_age_seconds 10$/m);
  });
});
