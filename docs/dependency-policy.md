# Dependency policy

Nexus VTT targets Node.js 26.5.x in development, CI, and containers. The root
package owns the lockfile for every npm workspace.

- Apply patch and minor upgrades after type checking, unit tests, and builds.
- Review major upgrades separately when they change runtime or configuration
  contracts.
- Run `npm audit` and inspect the full dependency path before replacing a
  package because of a transitive deprecation warning.
- Permit install scripts only for reviewed packages in `allowScripts`.
  `esbuild` and `sharp` require their platform installers; the dice package's
  copy script is disabled because `scripts/sync-dice-assets.js` performs a
  deterministic, validated sync.
- Keep `patch-package` patches documented and remove them when upstream fixes
  are available.

The remaining `glob@11.1.0` and `source-map@0.8.0-beta.0` deprecation messages
currently come through Workbox in `vite-plugin-pwa`. They have no reported
audit vulnerability in this lockfile and should be resolved by an upstream
Workbox release rather than by forcing incompatible transitive versions.
