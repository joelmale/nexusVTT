/**
 * Toast Notification Component
 *
 * Provides user-friendly error and success notifications.
 * Automatically dismisses after a timeout.
 */

import React, { useEffect } from 'react';
import { X, AlertCircle, CheckCircle, Info } from 'lucide-react';

export type ToastType = 'error' | 'success' | 'info';

export interface ToastProps {
  message: string;
  type?: ToastType;
  duration?: number;
  onClose: () => void;
}

const Toast: React.FC<ToastProps> = ({
  message,
  type = 'error',
  duration = 5000,
  onClose
}) => {
  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(onClose, duration);
      return () => clearTimeout(timer);
    }
  }, [duration, onClose]);

  const icons = {
    error: <AlertCircle className="w-5 h-5" />,
    success: <CheckCircle className="w-5 h-5" />,
    info: <Info className="w-5 h-5" />
  };

  const styles = {
    error: 'bg-red-500/90 text-white',
    success: 'bg-green-500/90 text-white',
    info: 'bg-blue-500/90 text-white'
  };

  return (
    <div className={`fixed bottom-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg ${styles[type]} animate-slide-up max-w-md`}>
      {icons[type]}
      <p className="flex-1 font-medium">{message}</p>
      <button
        onClick={onClose}
        className="hover:opacity-70 transition-opacity"
        aria-label="Close notification"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

export default Toast;
