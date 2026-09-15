/**
 * Minimal `import.meta.env` declaration.
 *
 * Both host applications bundle this package with Vite and supply the full
 * `vite/client` types, but the package type-checks standalone too, so it
 * declares the handful of fields its own code reads.
 */
interface ImportMetaEnv {
  readonly DEV?: boolean;
  readonly PROD?: boolean;
  readonly MODE?: string;
  readonly [key: string]: string | boolean | undefined;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
