/**
 * Messaging channels (Telegram, Facebook Messenger, WhatsApp, Instagram).
 *
 * Many contacts only communicate through messaging apps and never share a
 * phone number, so each channel stores a handle/number/URL and resolves to a
 * direct click-to-chat link.
 */

export type MessagingChannelKey = 'telegram' | 'facebook' | 'whatsapp' | 'instagram';

export interface MessagingChannelDefinition {
  key: MessagingChannelKey;
  label: string;
  /** Short hint shown under the input in the contact form. */
  hint: string;
  placeholder: string;
  /** Tailwind text color token used for the icon. */
  colorClass: string;
  /** Builds the direct chat URL, or null when the stored value is unusable. */
  buildUrl: (raw: string) => string | null;
  /** How the handle should read in the UI. */
  formatDisplay: (raw: string) => string;
}

const stripHandle = (raw: string) =>
  raw
    .trim()
    .replace(/^@+/, '')
    .replace(/\/+$/, '');

const isUrl = (raw: string) => /^(https?:\/\/|www\.)/i.test(raw.trim());

const withProtocol = (raw: string) => {
  const trimmed = raw.trim();
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
};

const digitsOnly = (raw: string) => raw.replace(/\D/g, '');

export const MESSAGING_CHANNELS: MessagingChannelDefinition[] = [
  {
    key: 'telegram',
    label: 'Telegram',
    hint: 'Their Telegram username, with or without the @.',
    placeholder: '@username',
    colorClass: 'text-sky-500',
    buildUrl: (raw) => {
      const value = raw.trim();
      if (!value) return null;
      if (isUrl(value)) return withProtocol(value);
      const handle = stripHandle(value);
      return handle ? `https://t.me/${encodeURIComponent(handle)}` : null;
    },
    formatDisplay: (raw) => (isUrl(raw) ? raw.trim() : `@${stripHandle(raw)}`),
  },
  {
    key: 'facebook',
    label: 'Facebook Messenger',
    hint: 'Their Messenger username or full Facebook profile link.',
    placeholder: 'username or facebook.com/their.profile',
    colorClass: 'text-blue-600',
    buildUrl: (raw) => {
      const value = raw.trim();
      if (!value) return null;
      if (isUrl(value)) return withProtocol(value);
      const handle = stripHandle(value);
      return handle ? `https://m.me/${encodeURIComponent(handle)}` : null;
    },
    formatDisplay: (raw) => (isUrl(raw) ? raw.trim() : stripHandle(raw)),
  },
  {
    key: 'whatsapp',
    label: 'WhatsApp',
    hint: 'Include the country code, for example +1 555 123 4567.',
    placeholder: '+1 555 123 4567',
    colorClass: 'text-emerald-600',
    buildUrl: (raw) => {
      const value = raw.trim();
      if (!value) return null;
      if (isUrl(value)) return withProtocol(value);
      const digits = digitsOnly(value);
      return digits.length >= 7 ? `https://wa.me/${digits}` : null;
    },
    formatDisplay: (raw) => raw.trim(),
  },
  {
    key: 'instagram',
    label: 'Instagram',
    hint: 'Their Instagram handle, with or without the @.',
    placeholder: '@username',
    colorClass: 'text-pink-600',
    buildUrl: (raw) => {
      const value = raw.trim();
      if (!value) return null;
      if (isUrl(value)) return withProtocol(value);
      const handle = stripHandle(value);
      return handle ? `https://ig.me/m/${encodeURIComponent(handle)}` : null;
    },
    formatDisplay: (raw) => (isUrl(raw) ? raw.trim() : `@${stripHandle(raw)}`),
  },
];

export type MessagingChannelValues = Partial<Record<MessagingChannelKey, string | null | undefined>>;

export interface ResolvedMessagingChannel {
  key: MessagingChannelKey;
  label: string;
  url: string;
  display: string;
  colorClass: string;
}

/** Returns only the channels a contact actually has, with ready-to-use links. */
export const resolveMessagingChannels = (
  values: MessagingChannelValues | null | undefined,
): ResolvedMessagingChannel[] => {
  if (!values) return [];
  return MESSAGING_CHANNELS.flatMap((channel) => {
    const raw = values[channel.key];
    if (!raw || !String(raw).trim()) return [];
    const url = channel.buildUrl(String(raw));
    if (!url) return [];
    return [{
      key: channel.key,
      label: channel.label,
      url,
      display: channel.formatDisplay(String(raw)),
      colorClass: channel.colorClass,
    }];
  });
};
