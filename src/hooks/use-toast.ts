import { toast as sonnerToast } from 'sonner';

// Re-export sonner's toast directly for backward compatibility
export const toast = sonnerToast;

// Also provide as a hook
export function useToast() {
  return {
    success: (message: string) => sonnerToast.success(message),
    error: (message: string) => sonnerToast.error(message),
    info: (message: string) => sonnerToast.info(message),
    warning: (message: string) => sonnerToast.warning(message),
  };
}
