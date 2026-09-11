import { createPortal } from 'react-dom';

interface PortalProps {
  children: React.ReactNode;
}

export const Portal: React.FC<PortalProps> = ({ children }) => {
  const container = document.getElementById('portal-root');
  if (!container) {
    console.error('Portal root element not found');
    return null;
  }

  return createPortal(children, container);
};
