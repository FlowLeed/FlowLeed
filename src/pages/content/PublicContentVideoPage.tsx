import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Clock3, Film, Loader2, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PublicStoryBlocks } from "@/components/content/PublicStoryBlocks";
import { YouTubePlayer } from "@/components/content/YouTubePlayer";
import { supabase } from "@/integrations/supabase/client";
import { formatTimestamp } from "@/lib/contentUtils";
import type { RelatedStory, StoryBlock, StoryCta, StoryRecord } from "@/lib/storyTypes";
import { handleYoutubeThumbError, resolveThumb } from "@/lib/youtubeThumbnail";
import { cn } from "@/lib/utils";

type PublicVideo = { id: string; youtube_id: string; title: string | null; channel_name: string | null; thumbnail_url: string | null; duration_seconds: number | null; description: string | null; short_description: string | null; published_at: string | null };
type Analysis = { summary: string | null; themes: string[] | null; key_quotes: Array<{ text: string; start_seconds: number; impact_score: number }> | null };
type Payload = { story: StoryRecord | null; video: PublicVideo | null; analysis: Analysis | null; blocks: StoryBlock[]; cta: StoryCta | null; related: RelatedStory[] };

export default function PublicContentVideoPage() {
  const { slug, id } = useParams<{ slug: string; id: string }>();
  const [params, setParams] = useSearchParams();
  const [payload, setPayload] = useState<Payload | null>(null);
  const [orgName, setOrgName] = useState("");
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [seek, setSeek] = useState(Number(params.get("t") ?? 0) || 0);

  useEffect(() => {
    const load = async () => {
      if (!slug || !id) return;
      setLoading(true); setNotFound(false);
      const [{ data, error }, { data: orgRows }] = await Promise.all([
        supabase.rpc("get_public_story" as never, { p_slug: slug, p_content_id: id } as never),
        supabase.rpc("get_public_organization" as never, { p_slug: slug } as never),
      ]);
      if (error || !data) setNotFound(true); else setPayload(data as unknown as Payload);
      const org = (orgRows && Array.isArray(orgRows) ? orgRows[0] : orgRows) as { name?: string } | null | undefined;
      setOrgName(org?.name ?? ""); setLoading(false);
    };
    void load();
  }, [slug, id]);

  if (loading) return <div className="flex h-[100dvh] items-center justify-center bg-story-background text-foreground"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  if (notFound || !payload) return <div className="flex h-[100dvh] items-center justify-center bg-story-background p-6"><div className="max-w-md space-y-4 text-center"><Film className="mx-auto h-8 w-8 text-muted-foreground" /><h1 className="text-2xl font-semibold">Story not available</h1><p className="text-sm text-muted-foreground">This story is not shared publicly.</p><Button asChild variant="outline"><Link to={`/${slug}/content`}><ArrowLeft className="mr-2 h-4 w-4" />Back to stories</Link></Button></div></div>;

  const { story, video, analysis, blocks, cta, related } = payload;
  const title = story?.title ?? video?.title ?? "Untitled story";
  const person = story?.person_name ?? video?.channel_name;
  const summary = story ? story.summary : (video?.short_description ?? analysis?.summary);
  const category = story?.category ?? analysis?.themes?.[0];
  const format = story?.story_format ?? "vertical_video";
  const portrait = format === "vertical_video";
  const written = format === "written";
  const media = story?.lead_media_url ?? resolveThumb(video?.thumbnail_url, video?.youtube_id);
  const published = story?.published_at ?? video?.published_at;
  const publishedLabel = published ? new Date(published).toLocaleDateString(undefined, { year: "numeric", month: "long" }) : null;
  const jumpTo = (seconds: number) => { setSeek(seconds); setPlaying(true); const next = new URLSearchParams(params); next.set("t", String(Math.floor(seconds))); setParams(next, { replace: true }); window.scrollTo({ top: 0, behavior: "smooth" }); };

  return <div className="h-[100dvh] w-full overflow-y-auto overflow-x-hidden overscroll-contain bg-story-background text-foreground">
    <header className="sticky top-0 z-50 border-b border-story-border bg-story-background/95 backdrop-blur-md" style={{ paddingTop: "env(safe-area-inset-top)" }}><div className="mx-auto flex w-full max-w-7xl items-center gap-4 px-4 py-3 md:px-6 md:py-4"><Link to={`/${slug}/content`} className="min-w-0 flex-1"><img src={`https://lghamvpolwebtjwaxned.supabase.co/functions/v1/public-org-logo?slug=${encodeURIComponent(slug ?? "")}`} alt={orgName ? `${orgName} logo` : "Organization logo"} className="h-8 w-auto max-w-[11rem] object-contain md:h-10" onError={(event) => { event.currentTarget.style.display = "none"; }} /></Link><Button asChild variant="ghost" size="sm"><Link to={`/${slug}/content`}><ArrowLeft className="mr-2 h-4 w-4" />All stories</Link></Button></div></header>

    <main>
      <section className="mx-auto grid w-full max-w-7xl gap-7 px-4 pb-10 pt-8 md:px-6 md:pb-16 md:pt-12 lg:grid-cols-12 lg:items-center lg:gap-12">
        <div className="order-2 space-y-5 lg:order-1 lg:col-span-5">
          {category && <p className="text-xs font-semibold uppercase text-primary">{category}</p>}
          <h1 className="text-4xl font-semibold leading-[1.04] md:text-6xl lg:text-7xl">{title}</h1>
          {person && <p className="text-base font-medium text-foreground/75">{person}</p>}
          {summary && <p className="max-w-xl text-base leading-7 text-muted-foreground md:text-lg md:leading-8">{summary}</p>}
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">{publishedLabel && <span>{publishedLabel}</span>}{video?.duration_seconds != null && <span className="inline-flex items-center gap-1.5"><Clock3 className="h-3.5 w-3.5" />{formatTimestamp(video.duration_seconds)}</span>}</div>
        </div>
        <div className={cn("order-1 lg:order-2 lg:col-span-7", portrait && "flex justify-center lg:justify-end")}>
          <div className={cn("relative overflow-hidden bg-story-media", portrait ? "aspect-[9/16] w-full max-w-[430px]" : "aspect-video w-full")}>
            {video?.youtube_id && playing ? <YouTubePlayer youtubeId={video.youtube_id} title={title} startSeconds={seek} autoplay className="absolute inset-0" /> : <>{media && <img src={media} alt={story?.lead_media_alt ?? ""} onError={video ? handleYoutubeThumbError : undefined} className="absolute inset-0 h-full w-full object-cover" />}{video?.youtube_id && <button type="button" onClick={() => setPlaying(true)} className="group absolute inset-0 flex items-center justify-center bg-story-overlay/20" aria-label={`Play ${title}`}><span className="inline-flex h-16 w-16 items-center justify-center rounded-full border border-story-overlay-border bg-story-overlay text-story-overlay-foreground backdrop-blur-sm transition-transform group-hover:scale-105"><Play className="ml-1 h-5 w-5 fill-current" /></span></button>}</>}
          </div>
        </div>
      </section>

      <section className="border-y border-story-border bg-story-paper"><div className="mx-auto w-full max-w-3xl px-4 py-12 md:px-6 md:py-20">
        {blocks.length > 0 && <PublicStoryBlocks blocks={blocks} />}
        {false && <p className="text-center text-muted-foreground">This story is being prepared.</p>}
      </div></section>

      {cta && story?.cta_mode !== "none" && <section className="bg-primary text-primary-foreground"><div className="mx-auto flex w-full max-w-5xl flex-col items-start gap-6 px-4 py-14 md:flex-row md:items-center md:justify-between md:px-6 md:py-20"><div className="max-w-2xl"><h2 className="text-3xl font-semibold leading-tight md:text-4xl">{cta.headline}</h2>{cta.description && <p className="mt-3 text-base leading-7 text-primary-foreground/80">{cta.description}</p>}</div><Button asChild size="lg" variant="secondary" className="min-h-12 w-full shrink-0 md:w-auto"><a href={cta.destination_url}>{cta.button_label}<ArrowRight className="ml-2 h-4 w-4" /></a></Button></div></section>}

      {related.length > 0 && <section className="mx-auto w-full max-w-7xl px-4 py-14 md:px-6 md:py-20"><div className="mb-7"><p className="text-xs font-semibold uppercase text-primary">Keep exploring</p><h2 className="mt-2 text-3xl font-semibold">More stories like this</h2></div><div className="-mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-3 md:mx-0 md:grid md:grid-cols-4 md:overflow-visible md:px-0">{related.map((item) => { const thumb = item.lead_media_url ?? resolveThumb(item.thumbnail_url, item.youtube_id); const itemId = item.source_video_id ?? item.id; return <Link key={item.id} to={`/${slug}/content/videos/${itemId}`} className="group w-[78vw] max-w-[310px] shrink-0 snap-start md:w-auto"><div className={cn("overflow-hidden bg-story-media", item.story_format === "vertical_video" ? "aspect-[4/5]" : "aspect-video")}>{thumb && <img src={thumb} alt="" onError={item.youtube_id ? handleYoutubeThumbError : undefined} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.025] motion-reduce:transition-none" />}</div>{item.category && <p className="mt-3 text-[11px] font-semibold uppercase text-primary">{item.category}</p>}<h3 className="mt-1 text-lg font-semibold leading-tight">{item.title}</h3>{item.person_name && <p className="mt-1 text-sm text-muted-foreground">{item.person_name}</p>}</Link>; })}</div></section>}
    </main>
  </div>;
}
