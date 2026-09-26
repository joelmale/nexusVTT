/**
 * @nexus/rules-contracts — shared, runtime-validated D&D 5e rules entities.
 *
 * Consumed by Codex (validation and storage), the control-plane admin forms,
 * and the VTT/Forge catalog adapters. Every entity states its ruleset
 * explicitly (`'2014' | '2024'`).
 *
 * Test fixtures live in `@nexus/rules-contracts/dist/fixtures` and are not
 * re-exported here so runtime bundles do not carry them.
 */
export * from './common.js';
export * from './spell.js';
export * from './item.js';
export * from './monster.js';
export * from './entity.js';
export * from './jsonPatch.js';
export * from './api.js';
export * from './catalogClient.js';
