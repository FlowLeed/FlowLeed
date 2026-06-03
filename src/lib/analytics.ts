import * as amplitude from '@amplitude/unified';

const API_KEY = 'b13e88c41d7f13678b0c273d876e067c';

let initialized = false;

export function initAnalytics() {
  if (initialized || typeof window === 'undefined') return;
  amplitude.initAll(API_KEY, {
    analytics: { autocapture: true },
    sessionReplay: { sampleRate: 1 },
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
