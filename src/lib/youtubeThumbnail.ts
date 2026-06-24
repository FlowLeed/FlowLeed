export type YoutubeThumbQuality = "maxres" | "hq" | "mq" | "default";

const QUALITY_FILE: Record<YoutubeThumbQuality, string> = {
  maxres: "maxresdefault.jpg",
  hq: "hqdefault.jpg",
  mq: "mqdefault.jpg",
  default: "0.jpg",
};

export const getYoutubeThumb = (
  youtubeId: string | null | undefined,
  quality: YoutubeThumbQuality = "maxres"
): string | null => {
  if (!youtubeId) return null;
  return `https://img.youtube.com/vi/${youtubeId}/${QUALITY_FILE[quality]}`;
};

/**
 * Resolve a thumbnail URL: prefer a stored one, otherwise fall back to YouTube's auto-poster.
 */
export const resolveThumb = (
  storedUrl: string | null | undefined,
  youtubeId: string | null | undefined,
  quality: YoutubeThumbQuality = "maxres"
): string | null => storedUrl || getYoutubeThumb(youtubeId, quality);

/**
 * onError handler that downgrades maxresdefault.jpg -> hqdefault.jpg when YouTube
 * has no maxres image for that video (returns a tiny grey placeholder).
 */
export const handleYoutubeThumbError = (
  e: React.SyntheticEvent<HTMLImageElement>
) => {
  const img = e.currentTarget;
  if (img.src.includes("maxresdefault.jpg")) {
    img.src = img.src.replace("maxresdefault.jpg", "hqdefault.jpg");
  }
};
