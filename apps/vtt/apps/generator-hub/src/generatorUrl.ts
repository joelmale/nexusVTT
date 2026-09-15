export type GeneratorSource =
  'dungeon' | 'world' | 'cave' | 'city' | 'dwelling';

const GENERATOR_PATHS: Record<GeneratorSource, string> = {
  dungeon: 'one-page-dungeon/index.html',
  world: 'world-map-generator/index.html',
  cave: 'cave-generator/index.html',
  city: 'city-generator/index.html',
  dwelling: 'dwellings-generator/index.html',
};

/**
 * Resolve generator assets relative to the hub document. In production the hub
 * is mounted below /generator-hub/, while its development server runs at the
 * origin root. Root-relative paths would escape the production mount and hit
 * the VTT SPA fallback instead.
 */
export function getGeneratorUrl(
  generator: GeneratorSource,
  hubDocumentUrl: string,
): string {
  return new URL(GENERATOR_PATHS[generator], hubDocumentUrl).toString();
}
