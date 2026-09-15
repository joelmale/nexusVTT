/**
 * Toast Hook
 *
 * Provides a simple API for showing toast notifications throughout the app.
 * Usage: const { showError, showSuccess, showInfo } = useToast();
 */

import { useState, useCallback } from 'react';

export interface ToastState {
  id: string;
  message: string;
  type: 'error' | 'success' | 'info';
  duration?: number;
}

export function useToast() {
  const [toasts, setToasts] = useState<ToastState[]>([]);

  const showToast = useCallback((message: string, type: 'error' | 'success' | 'info' = 'info', duration = 5000) => {
    const id = `toast-${Date.now()}-${Math.random()}`;
    setToasts(prev => [...prev, { id, message, type, duration }]);
  }, []);

  const showError = useCallback((message: string) => {
    showToast(message, 'error');
  }, [showToast]);

  const showSuccess = useCallback((message: string) => {
    showToast(message, 'success');
  }, [showToast]);

  const showInfo = useCallback((message: string) => {
    showToast(message, 'info');
  }, [showToast]);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  }, []);

  return {
    toasts,
    showToast,
    showError,
    showSuccess,
    showInfo,
    removeToast
  };
}
