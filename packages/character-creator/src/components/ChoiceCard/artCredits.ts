/**
 * Credits for third-party artwork used in the creator.
 *
 * The sigils are original placeholders today, so this is empty. Any imported
 * icon (for example from game-icons.net, CC BY 3.0) must be added here with
 * its author, licence and source before it ships; `artCredits.test.ts` fails
 * if an entry is missing a licence or an author.
 */
export interface ArtCredit {
  /** What the art is used for, e.g. "class:wizard". */
  usedFor: string;
  title: string;
  author: string;
  licence: string;
  source: string;
}

export const ART_CREDITS: readonly ArtCredit[] = [];
