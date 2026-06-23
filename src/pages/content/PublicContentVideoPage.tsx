import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, Film, Loader2, Play } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { formatTimestamp, youtubeEmbedUrl } from "@/lib/contentUtils";

interface Chunk { id: string; chunk_index: number; text: string; start_seconds: number; end_seconds: number; }
interface Analysis {
  summary: string | null;
  themes: string[] | null;
  story_patterns: Array<{ name: string; description: string }> | null;
  key_quotes: Array<{ text: string; start_seconds: number; impact_score: number }> | null;
  impact_score: number | null;
}
interface Video {
  id: string; youtube_id: string; title: string | null; channel_name: string | null;
  thumbnail_url: string | null; duration_seconds: number | null; description: string | null;
  published_at: string | null;
}

export default function PublicContentVideoPage() {
  const { slug, id } = useParams<{ slug: string; id: string }>();
  const [params, setParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [video, setVideo] = useState<Video | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [, setChunks] = useState<Chunk[]>([]);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const initialT = Number(params.get("t") ?? 0) || 0;
  const [currentSeek, setCurrentSeek] = useState(initialT);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (!slug || !id) return;
      setLoading(true);
      const { data, error } = await supabase.rpc("get_public_content_video" as any, {
        p_slug: slug, p_video_id: id,
      });
      if (error || !data) { setNotFound(true); setLoading(false); return; }
      const d = data as any;
      setVideo(d.video);
      setAnalysis(d.analysis);
      setChunks(d.chunks ?? []);
      setLoading(false);
    };
    load();
  }, [slug, id]);

  const embedSrc = useMemo(() => video ? youtubeEmbedUrl(video.youtube_id, currentSeek) : "", [video, currentSeek]);

  const jumpTo = (sec: number) => {
    setCurrentSeek(sec);
    setPlaying(true);
    const next = new URLSearchParams(params);
    next.set("t", String(Math.floor(sec)));
    setParams(next, { replace: true });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (notFound || !video) {
    return (
      <div className="h-screen flex items-center justify-center bg-background p-6">
        <Card className="p-10 text-center max-w-md space-y-3">
          <Film className="h-8 w-8 mx-auto text-muted-foreground" />
          <h1 className="text-xl font-light">Video not available</h1>
          <p className="text-sm text-muted-foreground">This video isn't shared publicly.</p>
          <Button asChild variant="outline" size="sm">
            <Link to={`/org/${slug}/content`}><ArrowLeft className="h-4 w-4 mr-1" /> Back to library</Link>
          </Button>
        </Card>
      </div>
    );
  }

  const publishedLabel = video.published_at
    ? new Date(video.published_at).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })
    : null;

  return (
    <div className="h-screen overflow-y-auto bg-gradient-to-b from-background to-muted/30">
      <div className="container max-w-4xl py-8 px-6 space-y-8">
        <div className="flex items-center justify-between">
          <Button asChild variant="ghost" size="sm" className="-ml-2">
            <Link to={`/org/${slug}/content`}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Back
            </Link>
          </Button>
        </div>

        {/* Player */}
        <div className="relative aspect-video w-full bg-black rounded-2xl overflow-hidden shadow-xl ring-1 ring-black/5">
          {playing ? (
            <iframe
              ref={iframeRef}
              key={embedSrc}
              src={`${embedSrc}${embedSrc.includes("?") ? "&" : "?"}autoplay=1`}
              title={video.title ?? "Video"}
              className="absolute inset-0 w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          ) : (
            <button
              type="button"
              onClick={() => setPlaying(true)}
              className="group absolute inset-0 w-full h-full"
              aria-label={`Play ${video.title ?? "video"}`}
            >
              {video.thumbnail_url ? (
                <img
                  src={video.thumbnail_url}
                  alt={video.title ?? ""}
                  className="absolute inset-0 w-full h-full object-cover"
                />
              ) : null}
              <div className="absolute inset-0 bg-black/20 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                <div className="h-16 w-16 rounded-full bg-white/95 flex items-center justify-center shadow-2xl group-hover:scale-110 transition-transform">
                  <Play className="h-7 w-7 fill-current text-black ml-1" />
                </div>
              </div>
            </button>
          )}
          {/* Mask YouTube title chrome on hover during playback */}
          {playing && (
            <div className="pointer-events-none absolute top-0 left-0 right-0 h-16 bg-gradient-to-b from-black to-transparent opacity-0" />
          )}
        </div>


        {/* Title block */}
        <div className="space-y-3">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight leading-tight">
            {video.title}
          </h1>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            {video.channel_name && <span className="font-medium text-foreground/80">{video.channel_name}</span>}
            {publishedLabel && (
              <>
                <span className="text-muted-foreground/50">·</span>
                <span>{publishedLabel}</span>
              </>
            )}
            {video.duration_seconds ? (
              <>
                <span className="text-muted-foreground/50">·</span>
                <span>{formatTimestamp(video.duration_seconds)}</span>
              </>
            ) : null}
          </div>

          {analysis?.themes && analysis.themes.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {analysis.themes.map((t) => (
                <Badge key={t} variant="secondary" className="font-normal capitalize">
                  {t}
                </Badge>
              ))}
            </div>
          )}
        </div>

        {/* About */}
        {(analysis?.summary || video.description) && (
          <Card className="p-6 md:p-8 space-y-3 border-0 shadow-sm bg-card/70 backdrop-blur">
            <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
              About this video
            </div>
            <p className="text-[15px] leading-relaxed whitespace-pre-wrap text-foreground/90">
              {analysis?.summary || video.description}
            </p>
          </Card>
        )}

        {/* Key moments */}
        {analysis?.key_quotes && analysis.key_quotes.length > 0 && (
          <div className="space-y-3">
            <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold px-1">
              Key moments
            </div>
            <div className="space-y-2">
              {analysis.key_quotes.map((q, i) => (
                <button
                  key={i}
                  onClick={() => jumpTo(q.start_seconds)}
                  className="group w-full text-left p-4 rounded-xl bg-card hover:bg-card border hover:border-violet-300 hover:shadow-sm transition-all flex gap-4 items-start"
                >
                  <div className="shrink-0 inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md bg-foreground text-background text-xs font-mono">
                    <Play className="h-3 w-3 fill-current" />
                    {formatTimestamp(q.start_seconds)}
                  </div>
                  <p className="text-[15px] leading-relaxed flex-1 text-foreground/90 group-hover:text-foreground">
                    "{q.text}"
                  </p>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="h-8" />
      </div>
    </div>
  );
}
