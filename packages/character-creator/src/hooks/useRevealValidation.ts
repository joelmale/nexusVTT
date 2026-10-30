import { useCallback, useEffect, useState } from 'react';

const NEXT_ATTEMPT_EVENT = 'nexus-creator:next-attempt';

/** Called when the player presses Next while the step is incomplete. */
export function notifyNextAttempt(): void {
  if (typeof window !== 'undefined')
    window.dispatchEvent(new Event(NEXT_ATTEMPT_EVENT));
}

/**
 * Holds validation messages back until the player has acted on that part of
 * the step (change or blur on its control) or has tried to press Next.
 * It never changes what counts as valid, only when the message is shown.
 */
export function useRevealValidation() {
  const [revealed, setRevealed] = useState(false);
  const reveal = useCallback(() => setRevealed(true), []);
  useEffect(() => {
    window.addEventListener(NEXT_ATTEMPT_EVENT, reveal);
    return () => window.removeEventListener(NEXT_ATTEMPT_EVENT, reveal);
  }, [reveal]);
  return { revealed, reveal, onInteract: reveal };
}
