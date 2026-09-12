import { toast as sonnerToast, ExternalToast } from 'sonner';

/**
 * Clean internal abstraction for notifications.
 * Isolates third-party UI libraries to ensure performance, 
 * accessibility, and ease of future migration.
 */
export const toast = {
  success: (message: string | React.ReactNode, data?: ExternalToast) => {
    return sonnerToast.success(message, data);
  },
  error: (message: string | React.ReactNode, data?: ExternalToast) => {
    return sonnerToast.error(message, data);
  },
  info: (message: string | React.ReactNode, data?: ExternalToast) => {
    return sonnerToast.info(message, data);
  },
  warning: (message: string | React.ReactNode, data?: ExternalToast) => {
    return sonnerToast.warning(message, data);
  },
  message: (message: string | React.ReactNode, data?: ExternalToast) => {
    return sonnerToast(message, data);
  },
  dismiss: (id?: string | number) => {
    return sonnerToast.dismiss(id);
  },
  loading: (message: string | React.ReactNode, data?: ExternalToast) => {
    return sonnerToast.loading(message, data);
  },
};
