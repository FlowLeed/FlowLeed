import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { ExternalLink, Loader2, PlayCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type YouTubePlayerProps = {
  youtubeId: string;
  title?: string | null;
  startSeconds?: number;
  autoplay?: boolean;
  className?: string;
};

export type YouTubePlayerHandle = {
  seekTo: (seconds: number, play?: boolean) => void;
};

type YouTubePlayerInstance = {
  destroy: () => void;
  getIframe?: () => HTMLIFrameElement;
};

type YouTubeApi = {
  Player: new (
    element: HTMLElement,
    config: {
      videoId: string;
      host?: string;
      playerVars: Record<string, string | number>;
      events?: {
        onReady?: (event: { target: YouTubePlayerInstance }) => void;
        onError?: () => void;
      };
    },
  ) => YouTubePlayerInstance;
};

declare global {
  interface Window {
    YT?: YouTubeApi;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let youtubeApiPromise: Promise<YouTubeApi> | null = null;

function loadYouTubeApi() {
  if (typeof window === "undefined") return Promise.reject(new Error("No window"));
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (youtubeApiPromise) return youtubeApiPromise;

  youtubeApiPromise = new Promise((resolve) => {
    const previousCallback = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previousCallback?.();
      resolve(window.YT!);
    };

    if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      tag.async = true;
      document.body.appendChild(tag);
    }
  });

  return youtubeApiPromise;
}

export const YouTubePlayer = forwardRef<YouTubePlayerHandle, YouTubePlayerProps>(function YouTubePlayer(
  { youtubeId, title, startSeconds, autoplay = false, className },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YouTubePlayerInstance | null>(null);
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const watchUrl = `https://www.youtube.com/watch?v=${encodeURIComponent(youtubeId)}${startSeconds ? `&t=${Math.floor(startSeconds)}s` : ""}`;

  useImperativeHandle(ref, () => ({
    seekTo: (seconds: number, play = true) => {
      const player = playerRef.current as (YouTubePlayerInstance & {
        seekTo?: (seconds: number, allowSeekAhead: boolean) => void;
        playVideo?: () => void;
      }) | null;
      player?.seekTo?.(seconds, true);
      if (play) player?.playVideo?.();
    },
  }));

  useEffect(() => {
    let cancelled = false;
    setHasError(false);
    setIsLoading(true);

    loadYouTubeApi()
      .then((YT) => {
        if (cancelled || !containerRef.current) return;
        playerRef.current?.destroy();
        playerRef.current = new YT.Player(containerRef.current, {
          videoId: youtubeId,
          host: "https://www.youtube.com",
          playerVars: {
            autoplay: autoplay ? 1 : 0,
            rel: 0,
            playsinline: 1,
            modestbranding: 1,
            origin: window.location.origin,
            start: startSeconds && startSeconds > 0 ? Math.floor(startSeconds) : 0,
          },
          events: {
            onReady: (event) => {
              if (cancelled) return;
              setIsLoading(false);
              const iframe = event.target.getIframe?.();
              iframe?.setAttribute("title", title ?? "Video");
              iframe?.setAttribute("referrerpolicy", "strict-origin-when-cross-origin");
              iframe?.setAttribute("allowfullscreen", "true");
            },
            onError: () => {
              if (cancelled) return;
              setIsLoading(false);
              setHasError(true);
            },
          },
        });
      })
      .catch(() => {
        if (!cancelled) {
          setIsLoading(false);
          setHasError(true);
        }
      });

    return () => {
      cancelled = true;
      playerRef.current?.destroy();
      playerRef.current = null;
    };
  }, [autoplay, startSeconds, title, youtubeId]);

  return (
    <div className={cn("relative h-full w-full bg-black", className)}>
      <div ref={containerRef} className="absolute inset-0 h-full w-full [&_iframe]:h-full [&_iframe]:w-full" />

      {isLoading && !hasError && (
        <div className="absolute inset-0 flex items-center justify-center bg-black text-white/70">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      )}

      {hasError && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#141418] p-6 text-center text-white">
          <div className="max-w-xs space-y-4">
            <PlayCircle className="mx-auto h-10 w-10 text-white/45" />
            <div className="space-y-1">
              <div className="text-base font-semibold">Video unavailable here</div>
              <p className="text-sm text-white/60">YouTube is blocking playback for this video. It may need embedding enabled or a public/unlisted visibility setting.</p>
            </div>
            <Button asChild size="sm" className="rounded-full bg-white text-black hover:bg-white/90">
              <a href={watchUrl} target="_blank" rel="noopener noreferrer">
                Open on YouTube <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
              </a>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
});