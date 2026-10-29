export type StepCommandType =
  | 'reminder'
  | 'open-scene'
  | 'deploy-encounter'
  | 'share-handout'
  | 'reveal-entry';

export function toCommandSelectValue(command: string): StepCommandType {
  const norm = command.toLowerCase().trim();
  if (
    norm === 'deploy encounter' ||
    norm === 'deploy-encounter' ||
    norm === 'encounter'
  ) {
    return 'deploy-encounter';
  }
  if (
    norm === 'activate scene' ||
    norm === 'open-scene' ||
    norm === 'activate-scene' ||
    norm === 'scene'
  ) {
    return 'open-scene';
  }
  if (
    norm === 'share handout' ||
    norm === 'share-handout' ||
    norm === 'handout'
  ) {
    return 'share-handout';
  }
  if (
    norm === 'reveal-entry' ||
    norm === 'reveal entry' ||
    norm === 'open-entry' ||
    norm === 'open note' ||
    norm === 'opening recap' ||
    norm === 'lore' ||
    norm === 'npc'
  ) {
    return 'reveal-entry';
  }
  return 'reminder';
}
