import React, { useEffect, useState, useRef } from 'react';
import ReactDOM from 'react-dom';

interface WindowPortalProps {
  children: React.ReactNode;
  onClose: () => void;
  title?: string;
  width?: number;
  height?: number;
}

function copyStyles(sourceDoc: Document, targetDoc: Document) {
  Array.from(sourceDoc.styleSheets).forEach((styleSheet) => {
    try {
      if (styleSheet.cssRules) {
        const newStyleEl = targetDoc.createElement('style');
        Array.from(styleSheet.cssRules).forEach((cssRule) => {
          newStyleEl.appendChild(targetDoc.createTextNode(cssRule.cssText));
        });
        targetDoc.head.appendChild(newStyleEl);
      }
    } catch {
      // Cross-origin stylesheets (like Google Fonts) might throw SecurityError.
      // We can fallback to cloning the link element.
      if (styleSheet.href) {
        const newLinkEl = targetDoc.createElement('link');
        newLinkEl.rel = 'stylesheet';
        newLinkEl.href = styleSheet.href;
        targetDoc.head.appendChild(newLinkEl);
      }
    }
  });

  // Also copy any direct <style> or <link> tags that might have been missed
  const stylesAndLinks = sourceDoc.querySelectorAll('style, link[rel="stylesheet"]');
  stylesAndLinks.forEach((el) => {
    targetDoc.head.appendChild(el.cloneNode(true) as HTMLElement);
  });
}

export const WindowPortal: React.FC<WindowPortalProps> = ({
  children,
  onClose,
  title = 'Nexus VTT',
  width = 400,
  height = 600,
}) => {
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const externalWindow = useRef<Window | null>(null);
  const pipWindow = useRef<Window | null>(null); // For Document PiP API

  useEffect(() => {
    let isMounted = true;
    const div = document.createElement('div');
    div.id = 'portal-root';
    div.style.width = '100%';
    div.style.height = '100%';

    const setupWindow = async () => {
      // 1. Try Document Picture-in-Picture API first (modern Chrome/Edge)
      if ('documentPictureInPicture' in window) {
        try {
          // @ts-expect-error: documentPictureInPicture API is experimental
          pipWindow.current = await window.documentPictureInPicture.requestWindow({
            width,
            height,
          });
          
          if (!isMounted) {
            pipWindow.current.close();
            return;
          }

          copyStyles(document, pipWindow.current.document);
          pipWindow.current.document.body.appendChild(div);
          
          pipWindow.current.addEventListener('pagehide', () => {
            if (isMounted) onClose();
          });
          
          setContainer(div);
          return; // Success
        } catch (e) {
          console.warn('Document PiP failed, falling back to window.open', e);
        }
      }

      // 2. Fallback to standard window.open
      externalWindow.current = window.open(
        '',
        '',
        `width=${width},height=${height},left=200,top=200,menubar=no,toolbar=no,location=no,status=no`
      );

      if (!externalWindow.current) {
        console.error('Pop-up blocked by browser');
        // You could dispatch a toast here
        onClose();
        return;
      }

      externalWindow.current.document.title = title;
      copyStyles(document, externalWindow.current.document);
      
      // Add basic body styles to match our dark theme background usually applied by #root
      externalWindow.current.document.body.style.backgroundColor = 'var(--surface)';
      externalWindow.current.document.body.style.color = 'var(--text)';
      externalWindow.current.document.body.style.margin = '0';
      externalWindow.current.document.body.style.padding = '0';
      externalWindow.current.document.body.style.overflow = 'hidden';

      externalWindow.current.document.body.appendChild(div);

      externalWindow.current.addEventListener('beforeunload', () => {
        if (isMounted) onClose();
      });

      setContainer(div);
    };

    setupWindow();

    return () => {
      isMounted = false;
      if (pipWindow.current) {
        pipWindow.current.close();
      }
      if (externalWindow.current) {
        externalWindow.current.close();
      }
    };
  }, [width, height, title, onClose]);

  if (!container) return null;

  return ReactDOM.createPortal(children, container);
};
