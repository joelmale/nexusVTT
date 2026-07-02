/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_ASSET_SERVER_URL: string;
  readonly VITE_WS_PORT: string;
  readonly VITE_BUILD_VERSION?: string;
  /**
   * Content-hash-chained delta-sync (PR-3). Default OFF: the client sends the
   * legacy untagged full snapshot and ignores ack/resync. Set to 'true' to
   * enable tagged-full/patch uploads and ack/resync/timeout reconciliation.
   * This flag is the rollback switch.
   */
  readonly VITE_DELTA_SYNC?: string;
  /**
   * Unified dev-mode switch ('true' | 'false'). Gates dev-only behaviour
   * (delta-sync resync logging, lobby dev tools, seeding UI). When unset,
   * falls back to import.meta.env.DEV. See src/utils/devMode.ts.
   */
  readonly VITE_DEV_MODE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface Window {
  __gameStore?: {
    getState: () => {
      sceneState: {
        scenes: unknown[];
      };
    };
  };
}
