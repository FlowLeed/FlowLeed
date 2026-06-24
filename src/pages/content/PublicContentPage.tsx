import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Search, Loader2, Play, Sparkles, Zap, X } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { formatTimestamp } from "@/lib/contentUtils";
import { cn } from "@/lib/utils";

interface PublicVideo {
  id: string;
  title: string | null;
  thumbnail_url: string | null;
  channel_name: string | null;
  short_description: string | null;
  youtube_id: string;
  duration_seconds: number | null;
}

interface VideoTheme {
  video_id: string;
  themes: string[];
}

interface AskSource {
  index: number;
  video_id: string;
  chunk_id: string;
  title: string | null;
  thumbnail_url: string | null;
  channel_name: string | null;
  snippet: string;
  start_seconds: number;
  similarity: number;
}

interface AskResponse {
  answer: string;
  sources: AskSource[];
}

export default function PublicContentPage() {
  const { slug } = useParams<{ slug: string }>();
  const storageKey = `public-content-search:${slug ?? ""}`;
  const initialState = (() => {
    if (typeof window === "undefined") return null;
    try {
      const raw = sessionStorage.getItem(storageKey);
      return raw ? (JSON.parse(raw) as { query: string; activeQuery: string; answer: AskResponse | null }) : null;
    } catch {
      return null;
    }
  })();
  const [query, setQuery] = useState(initialState?.query ?? "");
  const [videos, setVideos] = useState<PublicVideo[]>([]);
  const [videoThemes, setVideoThemes] = useState<Record<string, string[]>>({});
  const [activeTheme, setActiveTheme] = useState<string>("__all__");
  const [orgName, setOrgName] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [heroPlaying, setHeroPlaying] = useState(false);
  const [searching, setSearching] = useState(false);
  const [answer, setAnswer] = useState<AskResponse | null>(initialState?.answer ?? null);
  const [activeQuery, setActiveQuery] = useState<string>(initialState?.activeQuery ?? "");

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (answer && !searching) {
        sessionStorage.setItem(storageKey, JSON.stringify({ query, activeQuery, answer }));
      } else if (!answer) {
        sessionStorage.removeItem(storageKey);
      }
    } catch {
      // ignore
    }
  }, [storageKey, query, activeQuery, answer, searching]);

  useEffect(() => {
    const load = async () => {
      if (!slug) return;
      setLoading(true);
      const { data: org } = await supabase
        .from("organizations")
        .select("id, name")
        .eq("slug", slug)
        .maybeSingle();
      if (org) {
        setOrgName(org.name);
        const { data: vids } = await supabase
          .from("content_videos" as any)
          .select("id, title, thumbnail_url, channel_name, short_description, youtube_id, duration_seconds")
          .eq("organization_id", org.id)
          .eq("consent_level", "public_search")
          .order("created_at", { ascending: false });
        const list = (vids as unknown as PublicVideo[]) ?? [];
        setVideos(list);

        if (list.length) {
          const { data: analyses } = await supabase
            .from("content_analyses" as any)
            .select("video_id, themes")
            .in("video_id", list.map((v) => v.id));
          const map: Record<string, string[]> = {};
          ((analyses as unknown as VideoTheme[]) ?? []).forEach((a) => {
            map[a.video_id] = a.themes ?? [];
          });
          setVideoThemes(map);
        }
      }
      setLoading(false);
    };
    load();
  }, [slug]);

  const themeChips = useMemo(() => {
    const counts = new Map<string, number>();
    Object.values(videoThemes).forEach((themes) => {
      themes.forEach((t) => {
        const key = t.trim().toLowerCase();
        if (!key) return;
        counts.set(key, (counts.get(key) ?? 0) + 1);
      });
    });
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([t]) => t);
  }, [videoThemes]);

  const heroVideo = videos[0] ?? null;
  const gridVideos = useMemo(() => {
    const rest = heroVideo ? videos.filter((v) => v.id !== heroVideo.id) : videos;
    return rest.filter((v) => {
      if (activeTheme !== "__all__") {
        const themes = (videoThemes[v.id] ?? []).map((t) => t.trim().toLowerCase());
        if (!themes.includes(activeTheme)) return false;
      }
      return true;
    });
  }, [videos, videoThemes, activeTheme, heroVideo]);

  const runAISearch = async (q: string) => {
    if (!q.trim() || !slug) return;
    setActiveQuery(q);
    setQuery(q);
    setSearching(true);
    setAnswer({ answer: "", sources: [] });
    try {
      const { data, error } = await supabase.functions.invoke("content-ask", {
        body: { query: q, orgSlug: slug, public: true },
      });
      if (error) throw error;
      const payload = (data as AskResponse) ?? { answer: "", sources: [] };
      setAnswer(payload);
    } catch {
      setAnswer({
        answer: "Something went wrong while searching. Please try again.",
        sources: [],
      });
    } finally {
      setSearching(false);
    }
  };

  const clearSearch = () => {
    setAnswer(null);
    setActiveQuery("");
    setQuery("");
  };

  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);

  return (
    <div className="h-screen overflow-y-auto bg-[#0a0a0f] text-white">
      {/* Top Bar */}
      <header className="sticky top-0 z-30 bg-[#0a0a0f]/90 backdrop-blur-md border-b border-white/5">
        <div className="container max-w-7xl flex items-center gap-3 md:gap-6 py-3 md:py-4 px-4 md:px-6">
          {slug && (
            <div className="flex items-center shrink-0">
              <img
                src={`https://lghamvpolwebtjwaxned.supabase.co/functions/v1/public-org-logo?slug=${encodeURIComponent(slug)}`}
                alt={orgName ? `${orgName} logo` : "Organization logo"}
                className="object-contain h-8 md:h-10 w-auto max-w-[10rem] md:max-w-[12rem]"
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
              />
            </div>
          )}
          {/* Desktop search */}
          <form
            onSubmit={(e) => { e.preventDefault(); runAISearch(query); }}
            className="hidden md:block flex-1 max-w-2xl ml-auto"
          >
            <div className="flex items-center gap-2 rounded-full bg-white/5 border border-white/10 hover:border-white/20 transition-colors pl-5 pr-2 py-1.5">
              <Search className="h-4 w-4 text-white/40 shrink-0" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Try: 'Find stories about transformation' or 'Quotes about new life'"
                className="border-0 bg-transparent h-9 focus-visible:ring-0 px-1 text-sm text-white placeholder:text-white/30"
              />
              {query && (
                <Button type="submit" disabled={searching} size="sm" className="rounded-full h-8 px-4 bg-white text-black hover:bg-white/90">
                  {searching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                </Button>
              )}
            </div>
          </form>
          {/* Mobile search icon */}
          <button
            type="button"
            onClick={() => setMobileSearchOpen((v) => !v)}
            className="md:hidden ml-auto h-10 w-10 inline-flex items-center justify-center rounded-full text-white/80 hover:bg-white/10"
            aria-label="Search"
          >
            <Search className="h-5 w-5" />
          </button>
        </div>
        {/* Mobile expandable search */}
        {mobileSearchOpen && (
          <form
            onSubmit={(e) => { e.preventDefault(); runAISearch(query); setMobileSearchOpen(false); }}
            className="md:hidden px-4 pb-3"
          >
            <div className="flex items-center gap-2 rounded-full bg-white/5 border border-white/10 pl-4 pr-1 py-1">
              <Search className="h-4 w-4 text-white/40 shrink-0" />
              <Input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Ask anything…"
                className="border-0 bg-transparent h-9 focus-visible:ring-0 px-1 text-sm text-white placeholder:text-white/30"
              />
              {query && (
                <Button type="submit" disabled={searching} size="sm" className="rounded-full h-8 px-3 bg-white text-black hover:bg-white/90">
                  {searching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                </Button>
              )}
            </div>
          </form>
        )}
      </header>

      <main className="container max-w-7xl px-6 pb-20">
        {/* AI Answer takes over */}
        {answer !== null ? (
          <section className="space-y-5 pt-8">
            <div className="flex items-center justify-between">
              <div className="text-sm text-white/50">
                Asked: <span className="text-white font-medium">"{activeQuery}"</span>
              </div>
              <Button variant="ghost" size="sm" onClick={clearSearch} className="text-white/70 hover:text-white hover:bg-white/10">
                <X className="h-4 w-4 mr-1" /> Clear
              </Button>
            </div>

            <div className="flex items-start gap-3">
              <div className="h-9 w-9 rounded-full bg-violet-500/20 text-violet-300 flex items-center justify-center shrink-0">
                <Sparkles className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1 space-y-5">
                {searching && !answer.answer ? (
                  <div className="flex items-center gap-2 text-sm text-white/50 py-2">
                    <Loader2 className="h-4 w-4 animate-spin" /> Listening to your library…
                  </div>
                ) : (
                  (() => {
                    const sourceMap = new Map(answer.sources.map((s) => [s.index, s]));
                    const paragraphs = answer.answer.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
                    return paragraphs.map((para, pIdx) => {
                      const cited: number[] = [];
                      const seen = new Set<number>();
                      const re = /\[#(\d+)\]/g;
                      let m;
                      while ((m = re.exec(para)) !== null) {
                        const idx = Number(m[1]);
                        if (!seen.has(idx) && sourceMap.has(idx)) {
                          cited.push(idx);
                          seen.add(idx);
                        }
                      }
                      const cleaned = para.replace(/\s*\[#\d+\]/g, "");
                      return (
                        <div key={pIdx} className="space-y-3">
                          <p className="text-[15px] leading-relaxed text-white/90">{cleaned}</p>
                          {cited.map((idx) => {
                            const s = sourceMap.get(idx)!;
                            return (
                              <Link
                                key={s.chunk_id}
                                to={`/org/${slug}/content/videos/${s.video_id}?t=${Math.floor(s.start_seconds)}`}
                                className="group flex gap-3 p-3 rounded-xl border border-white/10 bg-white/5 hover:border-violet-400/40 hover:bg-white/10 transition-all"
                              >
                                <div className="relative w-28 aspect-video rounded-lg overflow-hidden bg-black shrink-0">
                                  {s.thumbnail_url ? (
                                    <img src={s.thumbnail_url} alt="" className="absolute inset-0 w-full h-full object-cover" />
                                  ) : null}
                                  <div className="absolute top-1.5 left-1.5 px-1.5 h-5 inline-flex items-center rounded-md bg-black/70 text-white text-[10px] font-semibold gap-1">
                                    <Play className="h-2.5 w-2.5 fill-current" />
                                    {formatTimestamp(s.start_seconds)}
                                  </div>
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-baseline gap-2 mb-1">
                                    <span className="font-semibold text-sm truncate">{s.title ?? "Untitled"}</span>
                                    {s.channel_name && (
                                      <span className="text-[11px] text-white/40 truncate">· {s.channel_name}</span>
                                    )}
                                  </div>
                                  <blockquote className="border-l-2 border-violet-400/60 pl-3 text-[13px] italic text-white/60 line-clamp-3 leading-relaxed">
                                    "{s.snippet.trim()}"
                                  </blockquote>
                                </div>
                              </Link>
                            );
                          })}
                        </div>
                      );
                    });
                  })()
                )}
              </div>
            </div>
          </section>
        ) : (
          <>
            {/* Immersive Hero */}
            {heroVideo && (
              <>
                <section className="relative mt-4 md:mt-6 rounded-3xl overflow-hidden min-h-[340px] md:min-h-[520px] flex">
                  {/* Background */}
                  <div className="absolute inset-0">
                    {heroPlaying ? (
                      <iframe
                        src={`https://www.youtube.com/embed/${heroVideo.youtube_id}?autoplay=1&rel=0`}
                        title={heroVideo.title ?? "Featured video"}
                        className="absolute inset-0 w-full h-full"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    ) : (
                      <>
                        {heroVideo.thumbnail_url ? (
                          <img
                            src={heroVideo.thumbnail_url}
                            alt=""
                            className="absolute inset-0 w-full h-full object-cover opacity-40 md:opacity-60"
                          />
                        ) : (
                          <div className="absolute inset-0 bg-gradient-to-br from-violet-900/40 via-[#0a0a0f] to-[#0a0a0f]" />
                        )}
                        <div className="absolute inset-0 bg-gradient-to-r from-[#0a0a0f] via-[#0a0a0f]/85 to-[#0a0a0f]/40 hidden md:block" />
                        <div className="absolute inset-0 bg-gradient-to-b md:bg-gradient-to-t from-[#0a0a0f] via-[#0a0a0f]/40 md:via-transparent to-transparent md:to-transparent" />
                      </>
                    )}
                  </div>

                  {/* Mobile centered play */}
                  {!heroPlaying && (
                    <div className="relative z-10 flex md:hidden flex-col items-center justify-center w-full gap-3 py-16">
                      <button
                        onClick={() => setHeroPlaying(true)}
                        aria-label="Play featured story"
                        className="h-20 w-20 rounded-full border border-white/30 bg-white/5 backdrop-blur flex items-center justify-center hover:bg-white/10 transition"
                      >
                        <Play className="h-7 w-7 fill-current text-white ml-1" />
                      </button>
                      <div className="text-[11px] font-semibold tracking-[0.2em] text-white/50 uppercase">
                        Featured Story
                      </div>
                    </div>
                  )}

                  {/* Desktop overlay content */}
                  {!heroPlaying && (
                    <div className="relative z-10 hidden md:flex flex-col justify-center max-w-2xl p-10 md:p-14 gap-6">
                      <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-white/10 backdrop-blur w-fit text-[11px] font-bold tracking-wider uppercase">
                        <Zap className="h-3 w-3 fill-current" />
                        Trending Now
                      </div>
                      <h1 className="text-5xl md:text-6xl font-bold tracking-tight leading-[1.05]">
                        {heroVideo.title ?? "Discover Stories That Matter"}
                      </h1>
                      <p className="text-base text-white/70 max-w-lg leading-relaxed">
                        {heroVideo.short_description ??
                          `Experience powerful narratives of transformation, faith, and hope${orgName ? ` from ${orgName}` : ""}.`}
                      </p>
                      <div className="flex items-center gap-3 pt-2">
                        <Button
                          onClick={() => setHeroPlaying(true)}
                          className="rounded-full h-12 px-6 bg-white text-black hover:bg-white/90 font-semibold gap-2"
                        >
                          <Play className="h-4 w-4 fill-current" />
                          Watch Now
                        </Button>
                        <Link
                          to={`/org/${slug}/content/videos/${heroVideo.id}`}
                          className="text-sm text-white/70 hover:text-white px-4 py-3"
                        >
                          More info
                        </Link>
                      </div>
                    </div>
                  )}
                </section>

                {/* Mobile title block (below hero) */}
                {!heroPlaying && (
                  <div className="md:hidden mt-5 space-y-3">
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/10 w-fit text-[10px] font-bold tracking-wider uppercase">
                      <Zap className="h-3 w-3 fill-current" />
                      Trending Now
                    </div>
                    <h1 className="text-3xl font-bold tracking-tight leading-[1.1]">
                      {heroVideo.title ?? "Discover Stories That Matter"}
                    </h1>
                    {heroVideo.short_description && (
                      <p className="text-sm text-white/60 leading-relaxed">
                        {heroVideo.short_description}
                      </p>
                    )}
                  </div>
                )}
              </>
            )}

            {/* Theme Chips */}
            {themeChips.length > 0 && (
              <div className="flex md:flex-wrap items-center gap-2 mt-6 md:mt-10 overflow-x-auto md:overflow-visible -mx-4 px-4 md:mx-0 md:px-0 scrollbar-none">
                <button
                  onClick={() => setActiveTheme("__all__")}
                  className={cn(
                    "shrink-0 px-5 h-10 rounded-full text-sm font-medium transition-colors border",
                    activeTheme === "__all__"
                      ? "bg-white text-black border-white"
                      : "bg-transparent text-white/70 border-white/15 hover:border-white/40 hover:text-white",
                  )}
                >
                  All Stories
                </button>
                {themeChips.map((t) => (
                  <button
                    key={t}
                    onClick={() => setActiveTheme(t)}
                    className={cn(
                      "shrink-0 px-5 h-10 rounded-full text-sm font-medium transition-colors capitalize border",
                      activeTheme === t
                        ? "bg-white text-black border-white"
                        : "bg-transparent text-white/70 border-white/15 hover:border-white/40 hover:text-white",
                    )}
                  >
                    {t}
                  </button>
                ))}
              </div>
            )}

            {/* Grid */}
            <div className="mt-6">
              {loading ? (
                <div className="flex items-center gap-2 text-sm text-white/50 py-10">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading…
                </div>
              ) : gridVideos.length === 0 ? (
                <Card className="p-12 text-center text-sm text-white/50 bg-white/5 border-white/10">
                  {videos.length === 0
                    ? "This organization hasn't shared any videos publicly yet."
                    : "No stories match your filters."}
                </Card>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
                  {gridVideos.map((v) => {
                    const isPlaying = playingId === v.id;
                    return (
                      <div key={v.id} className="space-y-3 group">
                        <div className="relative aspect-[9/16] rounded-2xl overflow-hidden bg-white/5">
                          {isPlaying ? (
                            <iframe
                              src={`https://www.youtube.com/embed/${v.youtube_id}?autoplay=1&rel=0`}
                              title={v.title ?? "Video"}
                              className="absolute inset-0 w-full h-full"
                              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                              allowFullScreen
                            />
                          ) : (
                            <button
                              type="button"
                              onClick={() => setPlayingId(v.id)}
                              className="absolute inset-0 w-full h-full text-left"
                              aria-label={`Play ${v.title ?? "video"}`}
                            >
                              {v.thumbnail_url ? (
                                <img
                                  src={v.thumbnail_url}
                                  alt={v.title ?? ""}
                                  className="absolute inset-0 w-full h-full object-cover transition-transform group-hover:scale-105"
                                />
                              ) : (
                                <div className="absolute inset-0 flex items-center justify-center text-xs text-white/40">
                                  VIDEO
                                </div>
                              )}
                              <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
                              <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/20 transition-colors">
                                <div className="h-14 w-14 rounded-full bg-white/90 flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 transition-opacity">
                                  <Play className="h-6 w-6 fill-current text-black ml-0.5" />
                                </div>
                              </div>
                              {v.duration_seconds != null && (
                                <div className="absolute top-3 left-3 inline-flex items-center gap-1 px-2 py-1 rounded-md bg-black/60 text-white text-xs font-medium backdrop-blur-sm">
                                  <Play className="h-3 w-3 fill-current" />
                                  {formatTimestamp(v.duration_seconds)}
                                </div>
                              )}
                              <div className="absolute inset-x-0 bottom-0 p-4 space-y-1">
                                <div className="font-semibold text-sm text-white line-clamp-2 leading-snug">
                                  {v.title ?? "Untitled"}
                                </div>
                                {v.short_description && (
                                  <div className="text-[11px] text-white/60 line-clamp-2 leading-relaxed">
                                    {v.short_description}
                                  </div>
                                )}
                              </div>
                            </button>
                          )}
                        </div>
                        <Link to={`/org/${slug}/content/videos/${v.id}`} className="sr-only">
                          {v.title ?? "Untitled"}
                        </Link>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
