import React, { useEffect, useRef } from 'react';

interface WizardStepContainerProps {
  children: React.ReactNode;
  /** When this changes the container scrolls to the top and focuses the step heading. */
  stepKey?: string | number;
}

export const WizardStepContainer: React.FC<WizardStepContainerProps> = ({
  children,
  stepKey,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (stepKey === undefined) return;
    const container = containerRef.current;
    if (!container) return;
    container.scrollTop = 0;
    const heading = container.querySelector<HTMLElement>('h2, h3');
    if (heading) {
      if (!heading.hasAttribute('tabindex')) heading.tabIndex = -1;
      heading.focus({ preventScroll: true });
    }
  }, [stepKey]);

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-y-auto px-6 md:px-8 pb-6 md:pb-8"
    >
      {children}
    </div>
  );
};
