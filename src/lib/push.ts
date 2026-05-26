import { supabase } from "@/integrations/supabase/client";

// Public VAPID key — safe to ship in the client.
export const VAPID_PUBLIC_KEY =
  (import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined) ||
  "BBGrIhcN1uGC0029qLFCfP4iy4Mb0LbUfTiIxnmJ0k5_d6BV1A5CocKNB6gpwB_yADHPHPBLcUCVY0XeGMmaPmk";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export function isInPreviewIframe(): boolean {
  try {
    const inIframe = window.self !== window.top;
    const host = window.location.hostname;
    const isPreviewHost =
      host.includes("lovableproject.com") || host.includes("id-preview--") || host.includes("lovable.app") === false && false;
    // Allow on published lovable.app and custom domain; block iframe always.
    return inIframe || host.includes("id-preview--");
  } catch {
    return true;
  }
}

export function isPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // @ts-ignore iOS
    window.navigator.standalone === true
  );
}

export function isIOS(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

export async function registerPushServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!isPushSupported()) return null;
  if (isInPreviewIframe()) return null;
  try {
    const existing = await navigator.serviceWorker.getRegistration("/sw-push.js");
    if (existing) return existing;
    return await navigator.serviceWorker.register("/sw-push.js");
  } catch (e) {
    console.error("[push] sw registration failed", e);
    return null;
  }
}

export async function getPermission(): Promise<NotificationPermission> {
  if (!("Notification" in window)) return "denied";
  return Notification.permission;
}

export async function subscribeToPush(): Promise<PushSubscription | null> {
  if (!isPushSupported()) throw new Error("Push not supported on this browser.");
  if (isIOS() && !isStandalone()) {
    throw new Error(
      "On iOS, please first add Flow to your Home Screen (Share → Add to Home Screen), then enable push from the installed app."
    );
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error("Notification permission was not granted.");
  }

  const reg = await registerPushServiceWorker();
  if (!reg) throw new Error("Service worker unavailable in this context.");

  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY).buffer as ArrayBuffer,
    });
  }

  const json = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  const { error } = await supabase.functions.invoke("push-subscribe", {
    body: {
      endpoint: json.endpoint,
      p256dh: json.keys?.p256dh,
      auth: json.keys?.auth,
      user_agent: navigator.userAgent,
    },
  });
  if (error) throw error;

  return sub;
}

export async function unsubscribeFromPush(): Promise<void> {
  if (!isPushSupported()) return;
  const reg = await navigator.serviceWorker.getRegistration("/sw-push.js");
  const sub = await reg?.pushManager.getSubscription();
  if (sub) {
    const endpoint = sub.endpoint;
    await sub.unsubscribe();
    await supabase.functions.invoke("push-unsubscribe", { body: { endpoint } });
  }
}

export async function sendTestPush(): Promise<void> {
  const { error } = await supabase.functions.invoke("send-test-push", { body: {} });
  if (error) throw error;
}

export async function getCurrentSubscription(): Promise<PushSubscription | null> {
  if (!isPushSupported() || isInPreviewIframe()) return null;
  const reg = await navigator.serviceWorker.getRegistration("/sw-push.js");
  if (!reg) return null;
  return reg.pushManager.getSubscription();
}
