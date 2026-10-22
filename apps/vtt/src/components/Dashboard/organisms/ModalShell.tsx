import React, { useEffect, useId } from 'react';
import { GothicHeader } from '../atoms/Typography';
import { ParchmentTexture } from '../atoms/ParchmentTexture';

interface ModalShellProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}

/**
 * Shared dialog chrome for the dashboard modals: overlay, bronze-framed panel,
 * labelled title, and Escape-to-close.
 */
export const ModalShell: React.FC<ModalShellProps> = ({
  title,
  onClose,
  children,
}) => {
  const titleId = useId();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 motion-safe:animate-fade-in">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="
          relative bg-[#252a31] border-4 border-double border-[#8c6b4a]/60
          rounded-sm p-6 w-full max-w-sm shadow-2xl font-sans text-[#f1e6d3]
        "
      >
        {/* Parchment background overlay inside modal */}
        <ParchmentTexture opacity={0.02} />
        <GothicHeader
          level={3}
          variant="medieval"
          id={titleId}
          className="mb-4 border-b border-[#8c6b4a]/30 pb-2"
        >
          {title}
        </GothicHeader>
        {children}
      </div>
    </div>
  );
};
