import React, { useState, useRef, useCallback, useEffect } from 'react';
import DOMPurify from 'dompurify';
import { Portal } from './Portal';
import './Tooltip.css';

interface TooltipProps {
  text: string;
  children: React.ReactNode;
  className?: string;
}

/**
 * Portal-mounted tooltip component.
 * Portals into #portal-root and positions relative to the trigger element's
 * viewport coordinates, avoiding clipping by overflow:hidden containers while
 * keeping top-layer and anchor-positioning free of Chromium invariant crashes.
 */
export const Tooltip: React.FC<TooltipProps> = React.memo(
  ({ text, children, className }) => {
    const [isVisible, setIsVisible] = useState(false);
    const triggerRef = useRef<HTMLDivElement>(null);
    const [coords, setCoords] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

    const measure = useCallback(() => {
      const trigger = triggerRef.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      setCoords((previous) => {
        const top = rect.top - 8;
        const left = rect.left + rect.width / 2;
        // Bail out when nothing moved so this cannot loop via setState.
        return previous.top === top && previous.left === left
          ? previous
          : { top, left };
      });
    }, []);

    const showTooltip = useCallback(() => {
      measure();
      setIsVisible(true);
    }, [measure]);

    const hideTooltip = useCallback(() => {
      setIsVisible(false);
    }, []);

    // The trigger can move while the tooltip is open: PanelDock animates
    // max-width 200px -> 900px over 0.4s, so a position measured once on
    // mouseenter goes stale and the tooltip detaches from its button. CSS
    // anchor positioning used to track this for free; measuring on show does
    // not. Re-measure each frame while visible, plus on scroll and resize.
    useEffect(() => {
      if (!isVisible) return;

      let frame = 0;
      const tick = () => {
        measure();
        frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);

      window.addEventListener('scroll', measure, true);
      window.addEventListener('resize', measure);
      return () => {
        cancelAnimationFrame(frame);
        window.removeEventListener('scroll', measure, true);
        window.removeEventListener('resize', measure);
      };
    }, [isVisible, measure]);

    return (
      <div
        ref={triggerRef}
        className={`tooltip-container ${className || ''}`}
        onMouseEnter={showTooltip}
        onMouseLeave={hideTooltip}
        onFocus={showTooltip}
        onBlur={hideTooltip}
      >
        {children}
        {isVisible && (
          <Portal>
            <div
              className="tooltip-box"
              style={{
                position: 'fixed',
                top: `${coords.top}px`,
                left: `${coords.left}px`,
                transform: 'translate(-50%, -100%)',
                pointerEvents: 'none',
              }}
              role="tooltip"
            >
              <div
                dangerouslySetInnerHTML={{
                  __html: DOMPurify.sanitize(text, {
                    ALLOWED_URI_REGEXP: /^(?:(?:(?:ht)tps?|mailto):|[^a-z]|[a-z+.-]+(?:[^a-z+.-:]|$))/i,
                  }),
                }}
              />
            </div>
          </Portal>
        )}
      </div>
    );
  },
);
