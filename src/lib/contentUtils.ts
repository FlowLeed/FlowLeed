export function formatTimestamp(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  }
  return `${m}:${String(sec).padStart(2, "0")}`;
}

export function youtubeEmbedUrl(youtubeId: string, startSeconds?: number) {
  const params = new URLSearchParams({ enablejsapi: "1", rel: "0" });
  if (startSeconds && startSeconds > 0) params.set("start", String(startSeconds));
  return `https://www.youtube.com/embed/${youtubeId}?${params.toString()}`;
}

export function extractYouTubeId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname === "youtu.be") return u.pathname.slice(1) || null;
    if (u.hostname.includes("youtube.com")) {
      const v = u.searchParams.get("v");
      if (v) return v;
      const m = u.pathname.match(/\/(shorts|embed|v)\/([A-Za-z0-9_-]{6,})/);
      if (m) return m[2];
    }
  } catch { /* ignore */ }
  if (/^[A-Za-z0-9_-]{6,}$/.test(url)) return url;
  return null;
}
