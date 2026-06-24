## Goal
Whenever a video has no `thumbnail_url`, render YouTube's auto-generated thumbnail straight from `img.youtube.com`. No DB changes, no backfill, no storage.

## How YouTube thumbnails work
For any YouTube video ID, these URLs exist publicly with no API key:

```text
https://img.youtube.com/vi/<id>/maxresdefault.jpg   1280x720, not always available
https://img.youtube.com/vi/<id>/hqdefault.jpg       480x360,  always available
https://img.youtube.com/vi/<id>/mqdefault.jpg       320x180,  always available
https://img.youtube.com/vi/<id>/0.jpg               default poster
```

`maxresdefault` is the nicest but missing for some videos (returns a small grey placeholder). The safe pattern is: try `maxresdefault`, fall back to `hqdefault` on error.

## Changes

1. **Add a small helper** `src/lib/youtubeThumbnail.ts`:
   - `getYoutubeThumb(youtubeId, quality?)` returns the URL string.
   - `<YoutubeThumb />` component (img wrapper) that auto-falls-back from `maxresdefault` to `hqdefault` via `onError`.

2. **Use it in the public content page** `src/pages/content/PublicContentPage.tsx`:
   - Hero section: when `heroVideo.thumbnail_url` is missing, use `getYoutubeThumb(heroVideo.youtube_id)`.
   - Grid cards: same fallback for each tile.

3. **Optional second pass (only if you want it)**: same fallback in `PublicContentVideoPage.tsx` and any internal content pages that show video thumbs.

## Out of scope
- No DB writes, no migration, no edge function, no storage bucket.
- No literal "frame 0" extraction — that requires loading the video and CORS blocks it for YouTube. The `img.youtube.com` poster is the practical equivalent.
