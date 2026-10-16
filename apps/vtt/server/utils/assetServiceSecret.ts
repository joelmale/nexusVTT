/**
 * Shared secret the VTT presents to the asset service as `x-nexus-auth`.
 *
 * Every VTT call site must use this module so the gateway proxy and the
 * generated-map upload agree with the asset service, whose own fallback is
 * DEV_ASSET_SERVICE_SECRET (services/asset-service/src/index.ts).
 */
export const DEV_ASSET_SERVICE_SECRET = 'dev-local-asset-service-secret';

export function getAssetServiceSecret(
  env: NodeJS.ProcessEnv = process.env,
): string {
  return env.ASSET_SERVICE_SECRET || DEV_ASSET_SERVICE_SECRET;
}
