import React, { useEffect, useRef, useState } from 'react';
import X from 'lucide-react/dist/esm/icons/x';
import type { RevealedHandout } from '@/stores/handoutFeedStore';
import styles from './HandoutSpotlight.module.css';

export interface HandoutSpotlightProps {
  handout: RevealedHandout;
  onDismiss: () => void;
}

/** Full-screen view of a handout the DM just revealed. */
export const HandoutSpotlight: React.FC<HandoutSpotlightProps> = ({
  handout,
  onDismiss,
}) => {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const element = dialog.current;
    if (typeof element?.showModal === 'function') element.showModal();
    else element?.setAttribute('open', '');
    element?.querySelector('button')?.focus();
    return () => {
      element?.close?.();
      previous?.focus();
    };
  }, []);
  const [content, setContent] = useState<{ url: string; text: string }>();
  const textUrl = handout.url?.endsWith('.txt') ? handout.url : undefined;
  useEffect(() => {
    if (!textUrl) return;
    const controller = new AbortController();
    void fetch(textUrl, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error('The handout could not be loaded.');
        const text = await response.text();
        if (!controller.signal.aborted)
          setContent({ url: textUrl, text: text.slice(0, 200_000) });
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setContent({
            url: textUrl,
            text: 'The handout could not be loaded. Close and reopen it to retry.',
          });
      });
    return () => controller.abort();
  }, [textUrl]);
  return (
    <dialog
      ref={dialog}
      className={styles.spotlight}
      role="dialog"
      aria-modal="true"
      aria-label={handout.title}
      onCancel={(event) => {
        event.preventDefault();
        onDismiss();
      }}
    >
      <header className={styles.header}>
        <h2>{handout.title}</h2>
        <button
          type="button"
          className={styles.close}
          aria-label="Close handout"
          onClick={onDismiss}
        >
          <X size={24} aria-hidden="true" />
        </button>
      </header>
      {textUrl ? (
        <div className={styles.text}>
          {content?.url === textUrl ? content.text : 'Loading handout…'}
        </div>
      ) : (
        handout.url && (
          <img className={styles.image} src={handout.url} alt={handout.title} />
        )
      )}
    </dialog>
  );
};
