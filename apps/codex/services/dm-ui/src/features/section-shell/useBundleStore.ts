import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';

import type { CampaignFixtureBundle } from '@/demo/fixture-registry';
import { useCampaignContext } from '@/features/campaigns/CampaignContext';

import {
  createReadOnlyStore,
  READ_ONLY_ERROR,
  type BundleStore,
  type EditableKind,
  type SaveResult,
} from './bundleStore';
import { useServerBackend } from './ServerBackendContext';
import { useCampaignBundle } from './useCampaignBundle';

export type BundleStoreState =
  | { status: 'loading' }
  | {
      status: 'missing';
      reason: 'unknown-slug' | 'campaign-unavailable';
      message?: string;
    }
  | {
      status: 'ready';
      store: BundleStore;
      basePath: string;
      /** Set under `/demo/:slug`; enables "Start from this example". */
      exampleSlug?: string;
    };

interface ServerSnapshot {
  controller: object;
  status: 'loading' | 'ready' | 'error';
  bundle?: CampaignFixtureBundle;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Request failed';
}

/**
 * The store for the current route: read-only for fixtures, server-backed for
 * real campaigns when a backend is plugged in, otherwise read-only and empty.
 */
export function useBundleStore(): BundleStoreState {
  const base = useCampaignBundle();
  const { fixtureSlug } = useParams();
  const { activeCampaign } = useCampaignContext();
  const { backend } = useServerBackend();
  const isReal = !fixtureSlug;

  const controller = useMemo(
    () =>
      isReal && backend && activeCampaign
        ? backend.createServerBundleStore(activeCampaign)
        : undefined,
    [isReal, backend, activeCampaign],
  );

  const [server, setServer] = useState<ServerSnapshot | null>(null);
  const controllerRef = useRef(controller);
  controllerRef.current = controller;

  const reload = useCallback(async () => {
    const current = controllerRef.current;
    if (!current) return;
    try {
      const bundle = await current.load();
      if (controllerRef.current === current) {
        setServer({ controller: current, status: 'ready', bundle });
      }
    } catch {
      if (controllerRef.current === current) {
        setServer((previous) => ({
          controller: current,
          status: 'error',
          bundle: previous?.bundle,
        }));
      }
    }
  }, []);

  useEffect(() => {
    if (controller) void reload();
  }, [controller, reload]);

  const snapshot =
    controller && server?.controller === controller ? server : undefined;

  const applyResult = useCallback(
    async (
      current: object,
      result: SaveResult & { bundle?: CampaignFixtureBundle },
    ) => {
      if (!result.ok) return;
      if (result.bundle) {
        setServer({
          controller: current,
          status: 'ready',
          bundle: result.bundle,
        });
      } else {
        await reload();
      }
    },
    [reload],
  );

  const updateItem = useCallback(
    async (
      kind: EditableKind,
      id: string,
      patch: Record<string, unknown>,
    ): Promise<SaveResult> => {
      const current = controllerRef.current;
      if (!current) return { ok: false, error: READ_ONLY_ERROR };
      try {
        const result = await current.updateItem(kind, id, patch);
        // On a revision conflict, refetch so the store holds the authoritative
        // object (and its revision) before the user reloads or retries.
        if (result.conflict) await reload();
        else await applyResult(current, result);
        return {
          ok: result.ok,
          conflict: result.conflict,
          error: result.error,
        };
      } catch (error) {
        return { ok: false, error: errorMessage(error) };
      }
    },
    [applyResult, reload],
  );

  const addItem = useCallback(
    async (
      kind: EditableKind,
      draft: Record<string, unknown>,
    ): Promise<SaveResult & { id?: string }> => {
      const current = controllerRef.current;
      if (!current) return { ok: false, error: READ_ONLY_ERROR };
      try {
        const result = await current.addItem(kind, draft);
        if (result.conflict) await reload();
        else await applyResult(current, result);
        return {
          ok: result.ok,
          conflict: result.conflict,
          error: result.error,
          id: result.id,
        };
      } catch (error) {
        return { ok: false, error: errorMessage(error) };
      }
    },
    [applyResult, reload],
  );

  const reorderNotes = useCallback(
    async (orderedIds: string[]): Promise<SaveResult> => {
      const current = controllerRef.current;
      if (!current?.reorderNotes) return { ok: false, error: READ_ONLY_ERROR };
      try {
        const result = await current.reorderNotes(orderedIds);
        // A partial failure or conflict still changed some notes; refresh.
        if (result.ok) await applyResult(current, result);
        else await reload();
        return {
          ok: result.ok,
          conflict: result.conflict,
          error: result.error,
        };
      } catch (error) {
        return { ok: false, error: errorMessage(error) };
      }
    },
    [applyResult, reload],
  );

  const baseBundle = base.status === 'ready' ? base.bundle : undefined;
  const store = useMemo<BundleStore | undefined>(() => {
    if (!baseBundle) return undefined;
    if (!controller) return createReadOnlyStore(baseBundle);
    return {
      bundle: snapshot?.bundle ?? baseBundle,
      status: snapshot?.status ?? 'loading',
      // Only editable once the authoritative bundle has loaded; a failed load
      // (e.g. 403 for a non-DM) leaves the campaign read-only.
      editable: controller.canEdit !== false && snapshot?.bundle !== undefined,
      reload,
      updateItem,
      addItem,
      reorderNotes,
    };
  }, [
    baseBundle,
    controller,
    snapshot,
    reload,
    updateItem,
    addItem,
    reorderNotes,
  ]);

  if (base.status !== 'ready') return base;
  if (!store) return { status: 'loading' };
  return {
    status: 'ready',
    store,
    basePath: base.basePath,
    exampleSlug: fixtureSlug,
  };
}
