import { randomInt } from 'node:crypto';

/**
 * Alphabet for player-facing join codes. Uppercase letters and digits only, so
 * codes stay easy to read aloud and type.
 */
const JOIN_CODE_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

/**
 * Generates a join/room code using a cryptographically secure source.
 *
 * A join code is the only credential needed to enter a session, so it must not
 * be predictable. `Math.random()` is seeded from observable state and its
 * output stream can be reconstructed from a few samples, which would let an
 * attacker who has seen one code enumerate others. `crypto.randomInt` draws
 * from the OS CSPRNG and rejects modulo-biased samples, so every character is
 * uniformly distributed.
 */
export function generateSecureJoinCode(length = 4): string {
  let code = '';
  for (let i = 0; i < length; i += 1) {
    code += JOIN_CODE_ALPHABET.charAt(randomInt(JOIN_CODE_ALPHABET.length));
  }
  return code;
}
