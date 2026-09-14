/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_VERSION: string;
  readonly VITE_LOG_LEVEL?: string;
  readonly VITE_ENABLE_LOGS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
