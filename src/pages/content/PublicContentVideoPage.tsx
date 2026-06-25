import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, Film, Loader2, Play } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { formatTimestamp, youtubeEmbedUrl } from "@/lib/contentUtils";
import { resolveThumb, handleYoutubeThumbError } from "@/lib/youtubeThumbnail";

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
  short_description: string | null;
  published_at: string | null;
}

export default function PublicContentVideoPage() {
  const { slug, id } = useParams<{ slug: string; id: string }>();
  const [params, setParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [video, setVideo] = useState<Video | null>(null);
  const [orgName, setOrgName] = useState<string>("");
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
      const { data: org } = await supabase
        .from("organizations")
        .select("name")
        .eq("slug", slug)
        .maybeSingle();
      if (org) setOrgName(org.name);
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
      <div className="h-screen flex items-center justify-center bg-[#0a0a0f] text-white">
        <Loader2 className="h-6 w-6 animate-spin text-white/50" />
      </div>
    );
  }

  if (notFound || !video) {
    return (
      <div className="h-screen flex items-center justify-center bg-[#0a0a0f] p-6 text-white">
        <div className="p-10 text-center max-w-md space-y-3 rounded-2xl border border-white/10 bg-white/5">
          <Film className="h-8 w-8 mx-auto text-white/40" />
          <h1 className="text-xl font-light">Video not available</h1>
          <p className="text-sm text-white/60">This video isn't shared publicly.</p>
          <Button asChild variant="outline" size="sm" className="border-white/20 bg-white/5 text-white hover:bg-white/10">
            <Link to={`/org/${slug}/content`}><ArrowLeft className="h-4 w-4 mr-1" /> Back to library</Link>
          </Button>
        </div>
      </div>
    );
  }

  const publishedLabel = video.published_at
    ? new Date(video.published_at).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })
    : null;

  const heroThumb = resolveThumb(video.thumbnail_url, video.youtube_id);

  return (
    <div className="h-screen overflow-y-auto bg-[#0a0a0f] text-white">
      {/* Top Bar — matches library */}
      <header className="sticky top-0 z-30 bg-[#0a0a0f]/90 backdrop-blur-md border-b border-white/5">
        <div className="container max-w-7xl flex items-center gap-3 md:gap-6 py-3 md:py-4 px-4 md:px-6">
          {slug && (
            <Link to={`/org/${slug}/content`} className="flex items-center shrink-0">
              <img
                src={`https://lghamvpolwebtjwaxned.supabase.co/functions/v1/public-org-logo?slug=${encodeURIComponent(slug)}`}
                alt={orgName ? `${orgName} logo` : "Organization logo"}
                className="object-contain h-8 md:h-10 w-auto max-w-[10rem] md:max-w-[12rem]"
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
              />
            </Link>
          )}
          <Link
            to={`/org/${slug}/content`}
            className="ml-auto inline-flex items-center gap-2 text-sm text-white/70 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded-full px-4 py-2 transition"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
        </div>
      </header>

      <main className="container max-w-5xl px-4 md:px-6 pb-20">
        {/* Immersive Hero — portrait player with ambient backdrop */}
        <section className="relative mt-4 md:mt-6 rounded-3xl overflow-hidden min-h-[560px] md:min-h-[640px] flex flex-col md:flex-row">
          {/* Blurred ambient backdrop */}
          <div className="absolute inset-0">
            {heroThumb ? (
              <img
                src={heroThumb}
                alt=""
                onError={handleYoutubeThumbError}
                aria-hidden
                className="absolute inset-0 w-full h-full object-cover scale-125 blur-2xl opacity-60"
              />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-violet-900/40 via-[#0a0a0f] to-[#0a0a0f]" />
            )}
            <div className="absolute inset-0 bg-[#0a0a0f]/55" />
            <div className="absolute inset-0 hidden md:block bg-gradient-to-r from-[#0a0a0f] via-[#0a0a0f]/70 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 h-2/3 md:hidden bg-gradient-to-t from-[#0a0a0f] via-[#0a0a0f]/80 to-transparent" />
          </div>

          {/* Portrait player — desktop right, mobile centered top */}
          <div className="relative z-20 order-1 md:order-2 w-full md:w-auto flex md:block justify-center md:justify-end md:absolute md:right-10 lg:right-16 md:top-1/2 md:-translate-y-1/2 pt-6 md:pt-0">
            <div className="relative w-[60%] max-w-[240px] md:w-[280px] lg:w-[320px] aspect-[9/16] rounded-2xl overflow-hidden shadow-2xl ring-1 ring-white/10 bg-black">
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
                  aria-label={`Play ${video.title ?? "video"}`}
                  className="absolute inset-0 w-full h-full group"
                >
                  {heroThumb && (
                    <img
                      src={heroThumb}
                      alt={video.title ?? ""}
                      onError={handleYoutubeThumbError}
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                  )}
                  <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/40 transition">
                    <span className="h-14 w-14 rounded-full border border-white/60 bg-black/40 backdrop-blur flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Play className="h-5 w-5 fill-current text-white ml-0.5" />
                    </span>
                  </div>
                </button>
              )}
            </div>
          </div>

          {/* Text content — desktop left, mobile bottom */}
          <div className="relative z-10 order-2 md:order-1 flex flex-col justify-end md:justify-center md:max-w-xl w-full p-6 md:p-14 gap-3 md:gap-5">
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-white/60">
              {publishedLabel && <span>{publishedLabel}</span>}
              {publishedLabel && video.duration_seconds ? <span className="text-white/30">·</span> : null}
              {video.duration_seconds ? <span>{formatTimestamp(video.duration_seconds)}</span> : null}
            </div>
            <h1 className="text-3xl md:text-5xl font-bold tracking-tight leading-[1.05]">
              {video.title}
            </h1>
            {video.short_description && (
              <p className="text-sm md:text-base text-white/75 leading-relaxed italic">
                {video.short_description}
              </p>
            )}
            {analysis?.themes && analysis.themes.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {analysis.themes.map((t) => (
                  <Badge
                    key={t}
                    variant="secondary"
                    className="font-normal capitalize bg-white/10 text-white/80 hover:bg-white/15 border-0"
                  >
                    {t}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* About */}
        {(analysis?.summary || video.description) && (
          <section className="mt-8 md:mt-10 p-6 md:p-8 rounded-2xl border border-white/10 bg-white/[0.03] space-y-3">
            <div className="text-[11px] uppercase tracking-wider text-white/50 font-semibold">
              About this video
            </div>
            <p className="text-[15px] leading-relaxed whitespace-pre-wrap text-white/85">
              {analysis?.summary || video.description}
            </p>
          </section>
        )}

        {/* Key moments */}
        {analysis?.key_quotes && analysis.key_quotes.length > 0 && (
          <section className="mt-8 md:mt-10 space-y-3">
            <div className="text-[11px] uppercase tracking-wider text-white/50 font-semibold px-1">
              Key moments
            </div>
            <div className="space-y-2">
              {analysis.key_quotes.map((q, i) => (
                <button
                  key={i}
                  onClick={() => jumpTo(q.start_seconds)}
                  className="group w-full text-left p-4 rounded-xl border border-white/10 bg-white/[0.03] hover:border-violet-400/40 hover:bg-white/[0.06] transition-all flex gap-4 items-start"
                >
                  <div className="shrink-0 inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md bg-white text-black text-xs font-mono font-semibold">
                    <Play className="h-3 w-3 fill-current" />
                    {formatTimestamp(q.start_seconds)}
                  </div>
                  <p className="text-[15px] leading-relaxed flex-1 text-white/85 group-hover:text-white">
                    "{q.text}"
                  </p>
                </button>
              ))}
            </div>
          </section>
        )}

        <div className="h-8" />
      </main>
    </div>
  );
}
