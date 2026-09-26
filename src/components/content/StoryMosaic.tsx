import { Link } from "react-router-dom";
import { Clock3, Film, Play, Smartphone } from "lucide-react";

import { YouTubePlayer } from "@/components/content/YouTubePlayer";
import { Button } from "@/components/ui/button";
import { formatTimestamp } from "@/lib/contentUtils";
import { handleYoutubeThumbError, resolveThumb } from "@/lib/youtubeThumbnail";
import { cn } from "@/lib/utils";

export interface PublicStoryVideo {
  id: string;
  title: string | null;
  thumbnail_url: string | null;
  channel_name: string | null;
  short_description: string | null;
  youtube_id: string;
  duration_seconds: number | null;
  is_featured?: boolean;
}

type StoryFormat = "landscape" | "portrait" | "editorial" | "compact";

interface StoryMosaicProps {
  videos: PublicStoryVideo[];
  slug: string;
  playingId: string | null;
  onPlay: (id: string) => void;
}

const formatForIndex = (index: number): StoryFormat => {
  const sequence: StoryFormat[] = ["landscape", "portrait", "editorial", "compact", "portrait", "landscape"];
  return sequence[index % sequence.length];
};

const formatLabel = (format: StoryFormat, duration: number | null) => {
  if (format === "portrait") return "Vertical story";
  if (format === "editorial") return duration && duration > 180 ? "Long-form story" : "Story film";
  if (duration && duration <= 90) return "Short story";
  return "Story film";
};

const StoryMedia = ({ video, playing, onPlay, portrait = false }: {
  video: PublicStoryVideo;
  playing: boolean;
  onPlay: () => void;
  portrait?: boolean;
}) => {
  const thumbnail = resolveThumb(video.thumbnail_url, video.youtube_id);
  if (playing) {
    return (
      <YouTubePlayer
        youtubeId={video.youtube_id}
        title={video.title ?? "Story video"}
        autoplay
        className="absolute inset-0"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={onPlay}
      className="group/media absolute inset-0 h-full w-full overflow-hidden text-left"
      aria-label={`Play ${video.title ?? "story"}`}
    >
      {thumbnail ? (
        <img
          src={thumbnail}
          alt=""
          onError={handleYoutubeThumbError}
          className={cn(
            "absolute inset-0 h-full w-full transition-transform duration-700 motion-reduce:transition-none group-hover/media:scale-[1.025]",
            portrait ? "object-cover" : "object-cover object-center",
          )}
        />
      ) : (
        <div className="absolute inset-0 bg-story-media" />
      )}
      <div className="absolute inset-0 bg-story-scrim" />
      <span className="absolute left-1/2 top-1/2 inline-flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-story-overlay-border bg-story-overlay text-story-overlay-foreground opacity-90 backdrop-blur-sm transition-transform group-hover/media:scale-105">
        <Play className="ml-0.5 h-4 w-4 fill-current" />
      </span>
    </button>
  );
};

const StoryMeta = ({ video, format, light = false }: { video: PublicStoryVideo; format: StoryFormat; light?: boolean }) => (
  <div className={cn("flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-semibold uppercase", light ? "text-story-overlay-muted" : "text-muted-foreground")}>
    <span className="inline-flex items-center gap-1.5">
      {format === "portrait" ? <Smartphone className="h-3 w-3" /> : <Film className="h-3 w-3" />}
      {formatLabel(format, video.duration_seconds)}
    </span>
    {video.duration_seconds != null && (
      <span className="inline-flex items-center gap-1.5">
        <Clock3 className="h-3 w-3" /> {formatTimestamp(video.duration_seconds)}
      </span>
    )}
  </div>
);

export function StoryMosaic({ videos, slug, playingId, onPlay }: StoryMosaicProps) {
  const featured = videos.slice(0, 6);
  const more = videos.slice(6);

  return (
    <div className="space-y-14 md:space-y-20">
      <section aria-labelledby="editors-picks-heading">
        <div className="mb-6 flex items-end justify-between gap-4 md:mb-8">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase text-primary">Curated stories</p>
            <h2 id="editors-picks-heading" className="text-3xl font-semibold text-foreground md:text-4xl">Stories worth sharing</h2>
          </div>
          <span className="hidden text-sm text-muted-foreground sm:block">Film, testimony, and moments of faith</span>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-12 lg:auto-rows-[210px]">
          {featured.map((video, index) => {
            const format = formatForIndex(index);
            const isPortrait = format === "portrait";
            const isEditorial = format === "editorial";
            const span = format === "landscape"
              ? "lg:col-span-8 lg:row-span-2"
              : isPortrait
                ? "lg:col-span-4 lg:row-span-3"
                : isEditorial
                  ? "lg:col-span-4 lg:row-span-2"
                  : "lg:col-span-4 lg:row-span-1";

            if (isEditorial) {
              return (
                <article key={video.id} className={cn("flex min-h-[300px] flex-col border border-story-border bg-story-paper p-6 md:p-8", span)}>
                  <StoryMeta video={video} format={format} />
                  <div className="flex flex-1 flex-col justify-center py-8">
                    <h3 className="text-2xl font-semibold leading-tight text-foreground md:text-3xl">{video.title ?? "Untitled story"}</h3>
                    {video.short_description && <p className="mt-4 line-clamp-4 text-sm leading-6 text-muted-foreground">{video.short_description}</p>}
                  </div>
                  <div className="flex items-center justify-between gap-3 border-t border-story-border pt-4">
                    <span className="truncate text-xs text-muted-foreground">{video.channel_name ?? "Story Library"}</span>
                    <Button asChild variant="ghost" size="sm" className="h-9 px-3 text-xs">
                      <Link to={`/${slug}/content/videos/${video.id}`}>Open story</Link>
                    </Button>
                  </div>
                </article>
              );
            }

            return (
              <article
                key={video.id}
                className={cn(
                  "group relative overflow-hidden bg-story-media md:min-h-[300px]",
                  isPortrait ? "aspect-[4/5] md:aspect-auto" : format === "compact" ? "min-h-[240px]" : "aspect-[16/10] md:aspect-auto",
                  span,
                )}
              >
                <StoryMedia video={video} playing={playingId === video.id} onPlay={() => onPlay(video.id)} portrait={isPortrait} />
                {playingId !== video.id && (
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 p-5 md:p-7">
                    <StoryMeta video={video} format={format} light />
                    <h3 className={cn("mt-2 font-semibold leading-tight text-story-overlay-foreground", format === "landscape" ? "text-2xl md:text-4xl" : "text-xl md:text-2xl")}>{video.title ?? "Untitled story"}</h3>
                    {video.channel_name && <p className="mt-2 text-xs text-story-overlay-muted">{video.channel_name}</p>}
                  </div>
                )}
                <Link to={`/${slug}/content/videos/${video.id}`} className="absolute right-3 top-3 z-20 rounded-full bg-story-overlay px-3 py-2 text-xs font-medium text-story-overlay-foreground opacity-0 pointer-events-none backdrop-blur-sm transition-opacity group-hover:opacity-100 group-hover:pointer-events-auto focus:opacity-100 focus:pointer-events-auto [@media(hover:none)]:opacity-100 [@media(hover:none)]:pointer-events-auto">
                  View story
                </Link>
              </article>
            );
          })}
        </div>
      </section>

      {more.length > 0 && (
        <section aria-labelledby="more-stories-heading">
          <div className="mb-6">
            <h2 id="more-stories-heading" className="text-2xl font-semibold text-foreground md:text-3xl">More stories</h2>
            <p className="mt-1 text-sm text-muted-foreground">Short moments and longer journeys from our community.</p>
          </div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {more.map((video) => {
              const thumbnail = resolveThumb(video.thumbnail_url, video.youtube_id);
              return (
                <Link key={video.id} to={`/${slug}/content/videos/${video.id}`} className="group block min-w-0">
                  <div className="relative aspect-[4/5] overflow-hidden bg-story-media">
                    {thumbnail && <img src={thumbnail} alt="" onError={handleYoutubeThumbError} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.025] motion-reduce:transition-none" />}
                    <div className="absolute inset-0 bg-story-scrim-soft" />
                    <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-story-overlay px-2 py-1 text-[10px] font-medium text-story-overlay-foreground backdrop-blur-sm">
                      <Play className="h-2.5 w-2.5 fill-current" />
                      {video.duration_seconds != null ? formatTimestamp(video.duration_seconds) : "Watch"}
                    </span>
                  </div>
                  <h3 className="mt-3 truncate text-sm font-semibold text-foreground">{video.title ?? "Untitled story"}</h3>
                  {video.channel_name && <p className="mt-1 truncate text-xs text-muted-foreground">{video.channel_name}</p>}
                </Link>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}