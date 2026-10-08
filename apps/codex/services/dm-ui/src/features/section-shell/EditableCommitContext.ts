import { createContext, useContext } from 'react';

/**
 * Asks the surrounding `EditableSection` to save the current draft once the
 * pending `setDraft` has rendered. Use it for changes that never move focus
 * (custom pickers, add/remove rows); text inputs autosave on blur instead.
 */
export type EditableCommit = () => void;

const noop: EditableCommit = () => undefined;

export const EditableCommitContext = createContext<EditableCommit>(noop);

/** `commit()` for `renderForm` content; a no-op outside an `EditableSection`. */
export function useEditableCommit(): EditableCommit {
  return useContext(EditableCommitContext);
}
