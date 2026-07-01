/// <reference types="vite/client" />

declare global {
  interface Window {
    gtag?: (
      command: string,
      eventNameOrTargetId: string,
      params?: Record<string, unknown>
    ) => void;
    dataLayer?: unknown[];
  }
}

export {};

