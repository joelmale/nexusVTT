// Re-export shim: this module now lives in the shared character-creator
// workspace package so Nexus Forge and Nexus VTT share one implementation.
/* eslint-disable react-refresh/only-export-components -- pure re-export shim. */
export * from '@nexus/character-creator/components/Toast';
export { default } from '@nexus/character-creator/components/Toast';
