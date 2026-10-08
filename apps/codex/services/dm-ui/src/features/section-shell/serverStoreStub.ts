import type { ServerBundleBackend } from './bundleStore';

/**
 * SINGLE PLUG-IN POINT for the server-backed bundle store: adapts
 * `services/campaign-bundle-api.ts` to the shell's controller contract.
 * Results carry the store's latest bundle so the hook does not need to
 * refetch after every save.
 */
export async function loadServerBundleBackend(): Promise<ServerBundleBackend> {
  const api = await import('@/services/campaign-bundle-api');
  return {
    createServerBundleStore(campaign) {
      const store = api.createServerBundleStore(campaign);
      return {
        load: () => store.load(),
        async updateItem(kind, id, patch) {
          const result = await store.updateItem(kind, id, patch);
          return { ...result, bundle: store.getBundle() };
        },
        async addItem(kind, draft) {
          const result = await store.addItem(kind, draft);
          return { ...result, bundle: store.getBundle() };
        },
        async removeItem(kind, id) {
          const result = await store.removeItem(kind, id);
          return { ...result, bundle: store.getBundle() };
        },
        async restoreItem(kind, id) {
          const result = await store.restoreItem(kind, id);
          return { ...result, bundle: store.getBundle() };
        },
        getBacklinks: (id) => store.getBacklinks(id),
        async reorderNotes(orderedIds) {
          const result = await store.reorderNotes(orderedIds);
          return { ...result, bundle: store.getBundle() };
        },
      };
    },
    async seedFromFixture(slug) {
      const result = await api.seedFromFixture(slug);
      const notes = api.describeSeedResult(result);
      return notes.length === 0
        ? result.campaignId
        : {
            campaignId: result.campaignId,
            notes,
            failedCount: result.failed.length,
          };
    },
  };
}
