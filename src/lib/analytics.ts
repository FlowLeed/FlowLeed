import * as amplitude from '@amplitude/analytics-browser';

const API_KEY = import.meta.env.VITE_AMPLITUDE_API_KEY as string | undefined;

let initialized = false;

export function initAnalytics() {
  if (initialized || !API_KEY) {
    if (!API_KEY) {
      console.warn('[analytics] VITE_AMPLITUDE_API_KEY not set — Amplitude disabled.');
    }
    return;
  }
  amplitude.init(API_KEY, {
    autocapture: {
      attribution: true,
      pageViews: true,
      sessions: true,
      formInteractions: true,
      fileDownloads: true,
      elementInteractions: true,
    },
  });
  initialized = true;
}

export function identifyUser(userId: string, traits?: Record<string, unknown>) {
  if (!initialized) return;
  amplitude.setUserId(userId);
  if (traits) {
    const id = new amplitude.Identify();
    Object.entries(traits).forEach(([k, v]) => {
      if (v !== undefined && v !== null) id.set(k, v as any);
    });
    amplitude.identify(id);
  }
}

export function resetUser() {
  if (!initialized) return;
  amplitude.reset();
}

export function trackEvent(name: string, props?: Record<string, unknown>) {
  if (!initialized) return;
  amplitude.track(name, props);
}
