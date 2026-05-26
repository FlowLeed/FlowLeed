// supabase/functions/_shared/web-push.ts
// Minimal VAPID + Web Push encryption for Deno. No external deps.

const enc = new TextEncoder();
const dec = new TextDecoder();

function b64urlToBytes(s: string): Uint8Array {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function bytesToB64url(b: Uint8Array): string {
  let s = "";
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function importVapidPrivateKey(priv: string, pub: string): Promise<CryptoKey> {
  const d = b64urlToBytes(priv);
  const pubBytes = b64urlToBytes(pub); // 65 bytes: 0x04 + X(32) + Y(32)
  const x = bytesToB64url(pubBytes.slice(1, 33));
  const y = bytesToB64url(pubBytes.slice(33, 65));
  const jwk = {
    kty: "EC", crv: "P-256",
    d: bytesToB64url(d), x, y, ext: true,
  };
  return crypto.subtle.importKey("jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
}

async function signVapidJWT(audience: string, subject: string, vapidPub: string, vapidPriv: string): Promise<string> {
  const header = { typ: "JWT", alg: "ES256" };
  const payload = {
    aud: audience,
    exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60,
    sub: subject.startsWith("mailto:") || subject.startsWith("http") ? subject : `mailto:${subject}`,
  };
  const signingInput = `${bytesToB64url(enc.encode(JSON.stringify(header)))}.${bytesToB64url(enc.encode(JSON.stringify(payload)))}`;
  const key = await importVapidPrivateKey(vapidPriv, vapidPub);
  const sig = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, enc.encode(signingInput)));
  return `${signingInput}.${bytesToB64url(sig)}`;
}

// HKDF helper
async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, len: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info }, key, len * 8);
  return new Uint8Array(bits);
}

async function importP256Public(raw: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", raw, { name: "ECDH", namedCurve: "P-256" }, true, []);
}
async function generateEcdhKeypair(): Promise<CryptoKeyPair> {
  return crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]) as Promise<CryptoKeyPair>;
}

// Encrypt payload using aes128gcm content encoding per RFC 8291.
async function encryptPayload(
  payload: Uint8Array,
  p256dhB64: string,
  authB64: string,
): Promise<{ body: Uint8Array; }> {
  const ua_public = b64urlToBytes(p256dhB64); // 65 bytes uncompressed
  const auth_secret = b64urlToBytes(authB64);

  const keyPair = await generateEcdhKeypair();
  const as_public_raw = new Uint8Array(await crypto.subtle.exportKey("raw", keyPair.publicKey));

  const uaPubKey = await importP256Public(ua_public);
  const sharedBits = await crypto.subtle.deriveBits(
    { name: "ECDH", public: uaPubKey },
    keyPair.privateKey,
    256,
  );
  const ecdh_secret = new Uint8Array(sharedBits);

  // PRK_key = HKDF(auth_secret, ecdh_secret, "WebPush: info\0" + ua_public + as_public, 32)
  const keyInfo = new Uint8Array([
    ...enc.encode("WebPush: info\0"),
    ...ua_public,
    ...as_public_raw,
  ]);
  const prkKey = await hkdf(auth_secret, ecdh_secret, keyInfo, 32);

  // salt = 16 random bytes
  const salt = crypto.getRandomValues(new Uint8Array(16));

  // CEK = HKDF(salt, prkKey, "Content-Encoding: aes128gcm\0", 16)
  const cek = await hkdf(salt, prkKey, enc.encode("Content-Encoding: aes128gcm\0"), 16);
  // NONCE = HKDF(salt, prkKey, "Content-Encoding: nonce\0", 12)
  const nonce = await hkdf(salt, prkKey, enc.encode("Content-Encoding: nonce\0"), 12);

  // pad: payload + 0x02 (final record)
  const padded = new Uint8Array(payload.length + 1);
  padded.set(payload, 0);
  padded[payload.length] = 0x02;

  const cekKey = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, cekKey, padded));

  // Header: salt(16) || rs(uint32 BE) || idlen(uint8) || keyid(idlen)
  const rs = 4096;
  const keyid = as_public_raw; // 65 bytes
  const header = new Uint8Array(16 + 4 + 1 + keyid.length);
  header.set(salt, 0);
  const dv = new DataView(header.buffer);
  dv.setUint32(16, rs, false);
  header[20] = keyid.length;
  header.set(keyid, 21);

  const body = new Uint8Array(header.length + cipher.length);
  body.set(header, 0);
  body.set(cipher, header.length);
  return { body };
}

export interface PushSubscriptionData {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export async function sendWebPush(
  sub: PushSubscriptionData,
  payload: string | object,
  opts: { vapidPublicKey: string; vapidPrivateKey: string; subject: string; ttl?: number; topic?: string; urgency?: string; },
): Promise<Response> {
  const url = new URL(sub.endpoint);
  const audience = `${url.protocol}//${url.host}`;
  const jwt = await signVapidJWT(audience, opts.subject, opts.vapidPublicKey, opts.vapidPrivateKey);

  const payloadBytes = typeof payload === "string" ? enc.encode(payload) : enc.encode(JSON.stringify(payload));
  const { body } = await encryptPayload(payloadBytes, sub.p256dh, sub.auth);

  const headers: Record<string, string> = {
    "Authorization": `vapid t=${jwt}, k=${opts.vapidPublicKey}`,
    "Content-Encoding": "aes128gcm",
    "Content-Type": "application/octet-stream",
    "TTL": String(opts.ttl ?? 60 * 60 * 24),
    "Urgency": opts.urgency ?? "normal",
  };
  if (opts.topic) headers["Topic"] = opts.topic;

  return fetch(sub.endpoint, { method: "POST", headers, body });
}
