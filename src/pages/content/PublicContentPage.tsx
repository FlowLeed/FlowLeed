import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Loader2, Play, Search, X } from "lucide-react";
import { Link, useParams } from "react-router-dom";

import { AiSparkleIcon } from "@/components/content/AiSparkleIcon";
import { PublicStoryVideo, StoryMosaic } from "@/components/content/StoryMosaic";
import { YouTubePlayer } from "@/components/content/YouTubePlayer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { formatTimestamp } from "@/lib/contentUtils";
import { cn } from "@/lib/utils";
import { handleYoutubeThumbError, resolveThumb } from "@/lib/youtubeThumbnail";
import { askPublicLibrary } from "@/api/content";
import { getOrganizationLogoUrl } from "@/api/organizations";
import type { AskResponse } from "@shared/models/AskResponse";

interface VideoTheme {
  video_id: string;
  themes: string[];
}

const parseStoredSearch = (key: string) => {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? JSON.parse(raw) as { query: string; activeQuery: string; answer: AskResponse | null } : null;
  } catch {
    return null;
  }
};

export default function PublicContentPage() {
  const { slug } = useParams<{ slug: string }>();
  const storageKey = `public-content-search:${slug ?? ""}`;
  const initialState = useMemo(() => parseStoredSearch(storageKey), [storageKey]);
  const [query, setQuery] = useState(initialState?.query ?? "");
  const [videos, setVideos] = useState<PublicStoryVideo[]>([]);
  const [videoThemes, setVideoThemes] = useState<Record<string, string[]>>({});
  const [activeTheme, setActiveTheme] = useState("__all__");
  const [orgName, setOrgName] = useState("");
  const [loading, setLoading] = useState(true);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [heroPlaying, setHeroPlaying] = useState(false);
  const [searching, setSearching] = useState(false);
  const [answer, setAnswer] = useState<AskResponse | null>(initialState?.answer ?? null);
  const [activeQuery, setActiveQuery] = useState(initialState?.activeQuery ?? "");
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);

  useEffect(() => {
    if (answer && !searching) {
      sessionStorage.setItem(storageKey, JSON.stringify({ query, activeQuery, answer }));
    } else if (!answer) {
      sessionStorage.removeItem(storageKey);
    }
  }, [storageKey, query, activeQuery, answer, searching]);

  useEffect(() => {
    const load = async () => {
      if (!slug) return;
      setLoading(true);
      const { data: orgRows } = await supabase.rpc("get_public_organization" as never, { p_slug: slug } as never);
      const orgValue = orgRows as unknown;
      const org = (Array.isArray(orgValue) ? orgValue[0] : orgValue) as { id: string; name: string } | null | undefined;

      if (org) {
        setOrgName(org.name);
        const { data: videoRows } = await supabase
          .from("content_videos" as never)
          .select("id, title, thumbnail_url, channel_name, short_description, youtube_id, duration_seconds, is_featured")
          .eq("organization_id", org.id)
          .eq("consent_level", "public_search")
          .order("created_at", { ascending: false });
        const list = (videoRows as unknown as PublicStoryVideo[]) ?? [];
        setVideos(list);

        if (list.length > 0) {
          const { data: analyses } = await supabase
            .from("content_analyses" as never)
            .select("video_id, themes")
            .in("video_id", list.map((video) => video.id));
          const themes: Record<string, string[]> = {};
          ((analyses as unknown as VideoTheme[]) ?? []).forEach((analysis) => {
            themes[analysis.video_id] = analysis.themes ?? [];
          });
          setVideoThemes(themes);
        }
      }
      setLoading(false);
    };
    void load();
  }, [slug]);

  const themeChips = useMemo(() => {
    const counts = new Map<string, number>();
    Object.values(videoThemes).forEach((themes) => themes.forEach((theme) => {
      const key = theme.trim().toLowerCase();
      if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
    }));
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([theme]) => theme);
  }, [videoThemes]);

  const heroVideo = useMemo(() => videos.find((video) => video.is_featured) ?? videos[0] ?? null, [videos]);
  const visibleVideos = useMemo(() => {
    const withoutHero = heroVideo ? videos.filter((video) => video.id !== heroVideo.id) : videos;
    if (activeTheme === "__all__") return withoutHero;
    return withoutHero.filter((video) => (videoThemes[video.id] ?? []).some((theme) => theme.trim().toLowerCase() === activeTheme));
  }, [activeTheme, heroVideo, videoThemes, videos]);

  const runAISearch = async (searchQuery: string) => {
    if (!searchQuery.trim() || !slug) return;
    setActiveQuery(searchQuery);
    setQuery(searchQuery);
    setSearching(true);
    setAnswer({ answer: "", sources: [] });
    try {
      const response = await askPublicLibrary(searchQuery, slug);
      setAnswer(response);
    } catch {
      setAnswer({ answer: "Something went wrong while searching. Please try again.", sources: [] });
    } finally {
      setSearching(false);
    }
  };

  const clearSearch = () => {
    setAnswer(null);
    setActiveQuery("");
    setQuery("");
    setHeroPlaying(false);
    setPlayingId(null);
    setMobileSearchOpen(false);
  };

  const heroThumbnail = heroVideo ? resolveThumb(heroVideo.thumbnail_url, heroVideo.youtube_id) : null;

  return (
    <div className="h-[100dvh] w-full overflow-y-auto overflow-x-hidden overscroll-contain bg-story-background text-foreground">
      <header className="sticky top-0 z-50 border-b border-story-border bg-story-background/95 backdrop-blur-md" style={{ paddingTop: "env(safe-area-inset-top)" }}>
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center gap-3 px-4 md:h-20 md:px-6">
          {slug && (
            <Button variant="ghost" onClick={clearSearch} className="h-11 min-w-0 justify-start px-0 hover:bg-transparent hover:opacity-75" aria-label="Back to library home">
              <img
                src={getOrganizationLogoUrl(slug)}
                alt={orgName ? `${orgName} logo` : "Church logo"}
                className="h-8 w-auto max-w-[10rem] object-contain md:h-9 md:max-w-[13rem]"
                onError={(event) => { event.currentTarget.style.display = "none"; }}
              />
            </Button>
          )}
          <nav className="ml-auto hidden items-center gap-6 text-sm text-muted-foreground md:flex" aria-label="Story Library">
            <a href="#stories" className="transition-colors hover:text-foreground">Stories</a>
            <a href="#discover" className="transition-colors hover:text-foreground">Discover</a>
          </nav>
          <Button variant="ghost" size="icon" onClick={() => setMobileSearchOpen((open) => !open)} className="ml-auto h-11 w-11 md:hidden" aria-label="Search stories">
            <Search className="h-5 w-5" />
          </Button>
        </div>
        {mobileSearchOpen && (
          <form onSubmit={(event) => { event.preventDefault(); void runAISearch(query); setMobileSearchOpen(false); }} className="border-t border-story-border px-4 py-3 md:hidden">
            <div className="mx-auto flex max-w-7xl items-center gap-2">
              <AiSparkleIcon className="h-5 w-5 shrink-0 text-primary" />
              <Input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="What kind of story do you need?" className="h-11 border-0 bg-transparent px-1 text-base shadow-none focus-visible:ring-0" />
              <Button type="submit" size="sm" disabled={searching || !query.trim()} className="h-10 px-4">Search</Button>
            </div>
          </form>
        )}
      </header>

      <main>
        {answer !== null ? (
          <SearchResults answer={answer} activeQuery={activeQuery} searching={searching} slug={slug ?? ""} onClear={clearSearch} />
        ) : (
          <>
            <section className="mx-auto grid w-full max-w-7xl items-center gap-6 px-4 py-8 md:min-h-[680px] md:grid-cols-[minmax(0,1fr)_minmax(320px,0.72fr)] md:gap-14 md:px-6 md:py-12 lg:gap-20">
              <div className="max-w-2xl">
                <p className="mb-4 text-xs font-semibold uppercase text-primary">Featured story</p>
                <h1 className="text-4xl font-semibold leading-[1.02] text-foreground sm:text-5xl md:text-7xl md:leading-[0.98] lg:text-8xl">Stories of<br />life change.</h1>
                {heroVideo && (
                  <div className="mt-6 border-l-2 border-primary pl-5 md:mt-10 md:pl-7">
                    <h2 className="text-2xl font-semibold text-foreground md:text-3xl">{heroVideo.title ?? "Featured story"}</h2>
                    {heroVideo.channel_name && <p className="mt-2 text-sm text-muted-foreground">{heroVideo.channel_name}</p>}
                    {heroVideo.short_description && <p className="mt-3 line-clamp-3 max-w-xl text-sm leading-6 text-muted-foreground md:mt-4 md:text-base md:leading-7">{heroVideo.short_description}</p>}
                    <div className="mt-4 flex flex-wrap items-center gap-3 md:mt-6">
                      <Button onClick={() => setHeroPlaying(true)} className="h-11 gap-2 px-5">
                        <Play className="h-4 w-4 fill-current" /> Watch story
                      </Button>
                      <Button asChild variant="outline" className="h-11 px-5">
                        <Link to={`/${slug}/content/videos/${heroVideo.id}`}>More info</Link>
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              <div className="mx-auto w-full max-w-[205px] sm:max-w-[260px] md:max-w-[390px]">
                {heroVideo ? (
                  <div className="relative aspect-[9/16] overflow-hidden border-[6px] border-story-paper bg-story-media shadow-2xl">
                    {heroPlaying ? (
                      <>
                        <Button variant="secondary" size="sm" onClick={() => setHeroPlaying(false)} className="absolute left-3 top-3 z-20 h-9 gap-1.5 bg-story-overlay text-story-overlay-foreground hover:bg-story-overlay">
                          <ArrowLeft className="h-3.5 w-3.5" /> Back
                        </Button>
                        <YouTubePlayer youtubeId={heroVideo.youtube_id} title={heroVideo.title ?? "Featured story"} autoplay className="absolute inset-0" />
                      </>
                    ) : (
                      <Button variant="ghost" onClick={() => setHeroPlaying(true)} className="group absolute inset-0 h-full w-full rounded-none p-0" aria-label={`Play ${heroVideo.title ?? "featured story"}`}>
                        {heroThumbnail && <img src={heroThumbnail} alt="" onError={handleYoutubeThumbError} className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.025] motion-reduce:transition-none" />}
                        <div className="absolute inset-0 bg-story-scrim" />
                        <span className="absolute left-1/2 top-1/2 inline-flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-story-overlay-border bg-story-overlay text-story-overlay-foreground backdrop-blur-sm">
                          <Play className="ml-1 h-5 w-5 fill-current" />
                        </span>
                        <span className="absolute inset-x-0 bottom-0 p-6 text-left text-story-overlay-foreground">
                          <span className="text-[11px] font-semibold uppercase text-story-overlay-muted">Featured · {heroVideo.duration_seconds != null ? formatTimestamp(heroVideo.duration_seconds) : "Story"}</span>
                          <span className="mt-2 block text-xl font-semibold">{heroVideo.title ?? "Featured story"}</span>
                        </span>
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="aspect-[9/16] bg-story-media" />
                )}
              </div>
            </section>

            <section id="discover" className="border-y border-story-border bg-story-paper px-4 py-12 md:px-6 md:py-16">
              <div className="mx-auto max-w-3xl text-center">
                <AiSparkleIcon className="mx-auto h-6 w-6 text-primary" />
                <h2 className="mt-4 text-3xl font-semibold text-foreground md:text-4xl">What story do you need today?</h2>
                <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-muted-foreground">Search by a season of life, a question, or something you are walking through.</p>
                <form onSubmit={(event) => { event.preventDefault(); void runAISearch(query); }} className="mx-auto mt-7 flex max-w-2xl items-center gap-2 border border-story-border bg-story-background p-2 shadow-sm">
                  <AiSparkleIcon className="ml-2 h-5 w-5 shrink-0 text-primary" />
                  <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="I'm looking for stories about…" className="h-11 min-w-0 border-0 bg-transparent px-2 text-base shadow-none focus-visible:ring-0" />
                  <Button type="submit" disabled={searching || !query.trim()} className="h-10 shrink-0 px-5">
                    {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : "Search"}
                  </Button>
                </form>
                {themeChips.length > 0 && (
                  <div className="mt-6 flex items-center gap-2 overflow-x-auto pb-2 md:flex-wrap md:justify-center md:overflow-visible">
                    <Button variant={activeTheme === "__all__" ? "default" : "outline"} size="sm" onClick={() => setActiveTheme("__all__")} className="h-9 shrink-0 rounded-full px-4 text-xs">All stories</Button>
                    {themeChips.map((theme) => (
                      <Button key={theme} variant={activeTheme === theme ? "default" : "outline"} size="sm" onClick={() => setActiveTheme(theme)} className="h-9 shrink-0 rounded-full px-4 text-xs capitalize">{theme}</Button>
                    ))}
                  </div>
                )}
              </div>
            </section>

            <section id="stories" className="mx-auto w-full max-w-7xl px-4 py-14 md:px-6 md:py-20">
              {loading ? (
                <div className="flex items-center justify-center gap-2 py-24 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading stories…</div>
              ) : visibleVideos.length === 0 ? (
                <div className="border border-story-border bg-story-paper px-6 py-16 text-center text-sm text-muted-foreground">{videos.length === 0 ? "This church hasn't shared any stories publicly yet." : "No stories match this topic."}</div>
              ) : (
                <StoryMosaic videos={visibleVideos} slug={slug ?? ""} playingId={playingId} onPlay={setPlayingId} />
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}

function SearchResults({ answer, activeQuery, searching, slug, onClear }: {
  answer: AskResponse;
  activeQuery: string;
  searching: boolean;
  slug: string;
  onClear: () => void;
}) {
  const sourceMap = new Map(answer.sources.map((source) => [source.index, source]));
  const paragraphs = answer.answer.split(/\n{2,}/).map((paragraph) => paragraph.trim()).filter(Boolean);

  return (
    <section className="mx-auto min-h-[calc(100svh-5rem)] w-full max-w-4xl px-4 py-8 md:px-6 md:py-12">
      <div className="mb-8 flex items-start justify-between gap-4 border-b border-story-border pb-6">
        <div>
          <p className="text-xs font-semibold uppercase text-primary">Story search</p>
          <h1 className="mt-2 text-2xl font-semibold text-foreground md:text-3xl">“{activeQuery}”</h1>
        </div>
        <Button variant="ghost" size="sm" onClick={onClear} className="h-10 shrink-0 gap-1.5"><X className="h-4 w-4" /> Clear</Button>
      </div>

      {searching && !answer.answer ? (
        <div className="flex items-center gap-2 py-12 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Listening to the Story Library…</div>
      ) : (
        <div className="space-y-8">
          {paragraphs.map((paragraph, paragraphIndex) => {
            const cited: number[] = [];
            const seen = new Set<number>();
            const expression = /\[#(\d+)\]/g;
            let match: RegExpExecArray | null;
            while ((match = expression.exec(paragraph)) !== null) {
              const index = Number(match[1]);
              if (!seen.has(index) && sourceMap.has(index)) {
                cited.push(index);
                seen.add(index);
              }
            }
            const cleaned = paragraph.replace(/\s*\[#\d+\]/g, "");
            return (
              <div key={`${paragraphIndex}-${cleaned.slice(0, 16)}`} className="space-y-4">
                <p className="text-base leading-8 text-foreground">{cleaned}</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {cited.map((index) => {
                    const source = sourceMap.get(index);
                    if (!source) return null;
                    return (
                      <Link key={source.chunk_id} to={`/${slug}/content/videos/${source.video_id}?t=${Math.floor(source.start_seconds)}`} className="group grid grid-cols-[112px_1fr] overflow-hidden border border-story-border bg-story-paper transition-colors hover:border-primary/40">
                        <div className="relative aspect-video bg-story-media">
                          {source.thumbnail_url && <img src={source.thumbnail_url} alt="" className="h-full w-full object-cover" />}
                          <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-story-overlay px-2 py-1 text-[10px] text-story-overlay-foreground"><Play className="h-2.5 w-2.5 fill-current" /> {formatTimestamp(source.start_seconds)}</span>
                        </div>
                        <div className="min-w-0 p-3">
                          <h2 className="truncate text-sm font-semibold text-foreground">{source.title ?? "Untitled story"}</h2>
                          <p className="mt-2 line-clamp-2 text-xs leading-5 text-muted-foreground">“{source.snippet.trim()}”</p>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
