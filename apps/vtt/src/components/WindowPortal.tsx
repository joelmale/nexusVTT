import React, { useEffect, useState, useRef } from 'react';
import ReactDOM from 'react-dom';

interface WindowPortalProps {
  children: React.ReactNode;
  onClose: () => void;
  title?: string;
  width?: number;
  height?: number;
}

/** Attributes themeManager writes onto <html>; the popup needs them to theme. */
const THEME_ATTRIBUTES = [
  'data-theme',
  'data-color-scheme',
  'data-reduced-motion',
] as const;

/**
 * Mirror the host document's <html> attributes and inline custom properties
 * onto the popup. `copyStyles` clones rule text, but the theme lives in
 * attributes/inline styles on documentElement (see services/themeManager.ts),
 * which a stylesheet clone cannot carry.
 */
function copyTheme(sourceDoc: Document, targetDoc: Document) {
  for (const attr of THEME_ATTRIBUTES) {
    const value = sourceDoc.documentElement.getAttribute(attr);
    if (value !== null) {
      targetDoc.documentElement.setAttribute(attr, value);
    } else {
      targetDoc.documentElement.removeAttribute(attr);
    }
  }
  // themeManager also sets custom properties directly on documentElement.
  targetDoc.documentElement.style.cssText =
    sourceDoc.documentElement.style.cssText;
  targetDoc.documentElement.className = sourceDoc.documentElement.className;
}

/**
 * Clone the host document's stylesheets into `targetDoc`.
 *
 * Each sheet is copied exactly once: same-origin sheets have their rule text
 * inlined, and only sheets we cannot read (cross-origin, e.g. Google Fonts)
 * fall back to cloning the <link>. An earlier version also blanket-cloned
 * every <style>/<link> tag afterwards, duplicating every rule in the popup.
 */
function copyStyles(sourceDoc: Document, targetDoc: Document) {
  Array.from(sourceDoc.styleSheets).forEach((styleSheet) => {
    let rules: CSSRuleList | null;
    try {
      rules = styleSheet.cssRules;
    } catch {
      rules = null; // Cross-origin - fall through to the <link> clone below.
    }

    if (rules) {
      const newStyleEl = targetDoc.createElement('style');
      newStyleEl.appendChild(
        targetDoc.createTextNode(
          Array.from(rules)
            .map((rule) => rule.cssText)
            .join('\n'),
        ),
      );
      targetDoc.head.appendChild(newStyleEl);
      return;
    }

    if (styleSheet.href) {
      const newLinkEl = targetDoc.createElement('link');
      newLinkEl.rel = 'stylesheet';
      newLinkEl.href = styleSheet.href;
      targetDoc.head.appendChild(newLinkEl);
    }
  });
}

/**
 * Renders `children` into a separate OS window (Document Picture-in-Picture
 * where available, otherwise `window.open`).
 *
 * The window is created on mount and torn down on unmount - nothing else.
 * `onClose`, `title`, `width` and `height` are deliberately NOT effect
 * dependencies: `onClose` is typically an inline arrow with a fresh identity
 * each render, and re-running the effect would close and re-open the window on
 * every render. The re-open has no user gesture behind it, so the popup
 * blocker kills it and the panel tears itself down. Instead `onClose` is held
 * in a ref, and size/title changes are applied imperatively to the live window.
 */
export const WindowPortal: React.FC<WindowPortalProps> = ({
  children,
  onClose,
  title = 'Nexus VTT',
  width = 400,
  height = 600,
}) => {
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const externalWindow = useRef<Window | null>(null);
  const pipWindow = useRef<Window | null>(null);

  // Keep the latest onClose without making it an effect dependency.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  // Latest size/title for the initial open only; later changes are applied
  // imperatively by the effects below.
  const initialRef = useRef({ title, width, height });

  useEffect(() => {
    let isMounted = true;
    const div = document.createElement('div');
    div.id = 'nexus-window-portal-root';
    div.style.width = '100%';
    div.style.height = '100%';

    const {
      title: initialTitle,
      width: initialWidth,
      height: initialHeight,
    } = initialRef.current;

    const prepare = (targetDoc: Document) => {
      copyStyles(document, targetDoc);
      copyTheme(document, targetDoc);
      targetDoc.body.style.backgroundColor = 'var(--bg-primary)';
      targetDoc.body.style.color = 'var(--text-primary)';
      targetDoc.body.style.margin = '0';
      targetDoc.body.style.padding = '0';
      targetDoc.body.style.overflow = 'hidden';
      targetDoc.body.appendChild(div);
    };

    const setupWindow = async () => {
      // 1. Document Picture-in-Picture (modern Chrome/Edge): borderless,
      //    always-on-top. Requires transient activation, same as window.open.
      if ('documentPictureInPicture' in window) {
        try {
          pipWindow.current = await (
            window as unknown as {
              documentPictureInPicture: {
                requestWindow: (o: {
                  width: number;
                  height: number;
                }) => Promise<Window>;
              };
            }
          ).documentPictureInPicture.requestWindow({
            width: initialWidth,
            height: initialHeight,
          });

          if (!isMounted) {
            pipWindow.current.close();
            return;
          }

          prepare(pipWindow.current.document);
          pipWindow.current.document.title = initialTitle;

          pipWindow.current.addEventListener('pagehide', () => {
            if (isMounted) onCloseRef.current();
          });

          setContainer(div);
          return;
        } catch (e) {
          console.warn('Document PiP failed, falling back to window.open', e);
        }
      }

      // 2. Standard pop-up window.
      externalWindow.current = window.open(
        '',
        '',
        `width=${initialWidth},height=${initialHeight},left=200,top=200,menubar=no,toolbar=no,location=no,status=no`,
      );

      if (!externalWindow.current) {
        console.error('Pop-up blocked by browser');
        onCloseRef.current();
        return;
      }

      if (!isMounted) {
        externalWindow.current.close();
        return;
      }

      externalWindow.current.document.title = initialTitle;
      prepare(externalWindow.current.document);

      externalWindow.current.addEventListener('beforeunload', () => {
        if (isMounted) onCloseRef.current();
      });

      setContainer(div);
    };

    void setupWindow();

    return () => {
      isMounted = false;
      pipWindow.current?.close();
      pipWindow.current = null;
      externalWindow.current?.close();
      externalWindow.current = null;
    };
    // Mount/unmount only - see the component doc comment.
  }, []);

  // Apply title changes to the live window instead of recreating it.
  useEffect(() => {
    const win = pipWindow.current ?? externalWindow.current;
    if (win && !win.closed) {
      win.document.title = title;
    }
  }, [title, container]);

  // Apply size changes to the live window instead of recreating it.
  // Document PiP windows cannot be resized programmatically, so this is a
  // no-op there by design.
  useEffect(() => {
    const win = externalWindow.current;
    if (win && !win.closed) {
      win.resizeTo(width, height);
    }
  }, [width, height, container]);

  if (!container) return null;

  return ReactDOM.createPortal(children, container);
};
