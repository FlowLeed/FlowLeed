import * as amplitude from '@amplitude/unified';

const API_KEY = 'b13e88c41d7f13678b0c273d876e067c';

let initialized = false;

export function initAnalytics() {
  if (initialized || typeof window === 'undefined') return;
  if (import.meta.env.DEV === true) return;
  try {
    amplitude.initAll(API_KEY, {
      analytics: { autocapture: true },
      sessionReplay: { sampleRate: 1 },
    });
    initialized = true;
  } catch (err) {
    console.error('[analytics] initAll failed', err);
  }
}

export function identifyUser(userId: string, traits?: Record<string, unknown>) {
  if (!initialized) return;
  try {
    amplitude.setUserId(userId);
    if (traits) {
      const id = new amplitude.Identify();
      Object.entries(traits).forEach(([k, v]) => {
        if (v !== undefined && v !== null) id.set(k, v as any);
      });
      amplitude.identify(id);
    }
  } catch (err) {
    console.error('[analytics] identifyUser failed', err);
  }
}

export function resetUser() {
  if (!initialized) return;
  try {
    amplitude.reset();
  } catch (err) {
    console.error('[analytics] reset failed', err);
  }
}

export function trackEvent(name: string, props?: Record<string, unknown>) {
  if (!initialized) return;
  try {
    amplitude.track(name, props);
  } catch (err) {
    console.error('[analytics] track failed', err);
  }
}
