import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Search, Loader2, Play, Sparkles, Users, Heart, Sunrise, Home, X } from "lucide-react";

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

type CategoryKey = "transformation" | "faith" | "family" | "hope";

const CATEGORIES: {
  key: CategoryKey;
  label: string;
  icon: typeof Users;
  color: string;
  prompts: string[];
}[] = [
  {
    key: "transformation",
    label: "Transformation",
    icon: Sunrise,
    color: "from-amber-50 to-orange-50 text-amber-700 border-amber-200",
    prompts: [
      "Stories of life-changing moments",
      "Someone overcoming addiction",
      "A turning point that changed everything",
      "Finding purpose after hitting rock bottom",
    ],
  },
  {
    key: "faith",
    label: "Faith",
    icon: Sparkles,
    color: "from-violet-50 to-purple-50 text-violet-700 border-violet-200",
    prompts: [
      "Stories about answered prayer",
      "Encountering God for the first time",
      "Stepping out in faith",
      "Quotes about trusting God",
    ],
  },
  {
    key: "family",
    label: "Family",
    icon: Home,
    color: "from-emerald-50 to-teal-50 text-emerald-700 border-emerald-200",
    prompts: [
      "Restored family relationships",
      "Parents and kids finding faith together",
      "Marriage rebuilt after hard times",
      "Stories about forgiveness at home",
    ],
  },
  {
    key: "hope",
    label: "Hope",
    icon: Heart,
    color: "from-rose-50 to-pink-50 text-rose-700 border-rose-200",
    prompts: [
      "Stories of healing after loss",
      "Hope in the middle of suffering",
      "Quotes about new beginnings",
      "Light after a dark season",
    ],
  },
];

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
  const [openCategory, setOpenCategory] = useState<CategoryKey | null>(null);
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
      .slice(0, 8)
      .map(([t]) => t);
  }, [videoThemes]);

  const filtered = useMemo(() => {
    return videos.filter((v) => {
      if (activeTheme !== "__all__") {
        const themes = (videoThemes[v.id] ?? []).map((t) => t.trim().toLowerCase());
        if (!themes.includes(activeTheme)) return false;
      }
      return true;
    });
  }, [videos, videoThemes, activeTheme]);

  const runAISearch = async (q: string) => {
    if (!q.trim() || !slug) return;
    setActiveQuery(q);
    setQuery(q);
    setSearching(true);
    setOpenCategory(null);
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


  return (
    <div className="h-screen overflow-y-auto bg-background">
      <div className="container max-w-6xl py-4 px-6 space-y-6">
        {slug && (
          <div className="flex justify-center">
            <img
              src={`https://lghamvpolwebtjwaxned.supabase.co/functions/v1/public-org-logo?slug=${encodeURIComponent(slug)}`}
              alt={orgName ? `${orgName} logo` : "Organization logo"}
              className="object-contain"
              style={{ height: "15rem", width: "auto", maxWidth: "100%" }}
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
            />
          </div>
        )}
        {/* AI Hero */}
        <section className="text-center space-y-5 pt-2">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
            Discover Stories That Matter
          </h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            {orgName ? `Search across ${orgName}'s ` : "Search across your "}
            video library using natural language. Find the perfect story, quote, or
            moment in seconds.
          </p>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              runAISearch(query);
            }}
            className="max-w-3xl mx-auto"
          >
            <div className="flex items-center gap-2 rounded-2xl border bg-card shadow-sm pl-4 pr-2 py-2">
              <Search className="h-4 w-4 text-muted-foreground shrink-0" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Try: 'Find stories about transformation' or 'Quotes about new life'"
                className="border-0 bg-transparent h-11 focus-visible:ring-0 px-2 text-base"
              />
              <Button
                type="submit"
                disabled={!query.trim() || searching}
                className="rounded-xl h-11 px-5 gap-2"
              >
                {searching ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                Search
              </Button>
            </div>
          </form>

          {/* Category prompts */}
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            {CATEGORIES.map((cat) => {
              const Icon = cat.icon;
              const isOpen = openCategory === cat.key;
              return (
                <button
                  key={cat.key}
                  type="button"
                  onClick={() => setOpenCategory(isOpen ? null : cat.key)}
                  className={cn(
                    "inline-flex items-center gap-2 px-5 h-11 rounded-full text-sm font-medium border bg-gradient-to-br transition-all",
                    cat.color,
                    isOpen ? "ring-2 ring-offset-2 ring-foreground/10 scale-105" : "hover:scale-105",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {cat.label}
                </button>
              );
            })}
          </div>

          {openCategory && (
            <Card className="max-w-3xl mx-auto p-5 text-left">
              {(() => {
                const cat = CATEGORIES.find((c) => c.key === openCategory)!;
                const Icon = cat.icon;
                return (
                  <>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2 font-semibold">
                        <Icon className="h-4 w-4" />
                        {cat.label}
                      </div>
                      <button
                        type="button"
                        onClick={() => setOpenCategory(null)}
                        className="text-muted-foreground hover:text-foreground"
                        aria-label="Close suggestions"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="divide-y">
                      {cat.prompts.map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => runAISearch(p)}
                          className="w-full text-left py-3 text-sm hover:text-primary transition-colors"
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  </>
                );
              })()}
            </Card>
          )}
        </section>

        {/* AI answer */}
        {answer !== null && (
          <section className="space-y-5">
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                Asked: <span className="text-foreground font-medium">"{activeQuery}"</span>
              </div>
              <Button variant="ghost" size="sm" onClick={clearSearch}>
                <X className="h-4 w-4 mr-1" /> Clear
              </Button>
            </div>

            <div className="flex items-start gap-3">
              <div className="h-9 w-9 rounded-full bg-violet-100 text-violet-700 flex items-center justify-center shrink-0">
                <Sparkles className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1 space-y-5">
                {searching && !answer.answer ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                    <Loader2 className="h-4 w-4 animate-spin" /> Listening to your library…
                  </div>
                ) : (
                  (() => {
                    const sourceMap = new Map(answer.sources.map((s) => [s.index, s]));
                    const paragraphs = answer.answer
                      .split(/\n{2,}/)
                      .map((p) => p.trim())
                      .filter(Boolean);
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
                          <p className="text-[15px] leading-relaxed text-foreground/90">
                            {cleaned}
                          </p>
                          {cited.map((idx) => {
                            const s = sourceMap.get(idx)!;
                            return (
                              <Link
                                key={s.chunk_id}
                                to={`/org/${slug}/content/videos/${s.video_id}?t=${Math.floor(s.start_seconds)}`}
                                className="group flex gap-3 p-3 rounded-xl border bg-card hover:border-violet-300 hover:shadow-sm transition-all"
                              >
                                <div className="relative w-28 aspect-video rounded-lg overflow-hidden bg-muted shrink-0">
                                  {s.thumbnail_url ? (
                                    <img
                                      src={s.thumbnail_url}
                                      alt=""
                                      className="absolute inset-0 w-full h-full object-cover"
                                    />
                                  ) : null}
                                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                                    <div className="h-8 w-8 rounded-full bg-white/95 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                      <Play className="h-3.5 w-3.5 fill-current text-black ml-0.5" />
                                    </div>
                                  </div>
                                  <div className="absolute top-1.5 left-1.5 px-1.5 h-5 inline-flex items-center rounded-md bg-black/70 text-white text-[10px] font-semibold gap-1">
                                    <Play className="h-2.5 w-2.5 fill-current" />
                                    {formatTimestamp(s.start_seconds)}
                                  </div>
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-baseline gap-2 mb-1">
                                    <span className="font-semibold text-sm truncate">
                                      {s.title ?? "Untitled"}
                                    </span>
                                    {s.channel_name && (
                                      <span className="text-[11px] text-muted-foreground truncate">
                                        · {s.channel_name}
                                      </span>
                                    )}
                                  </div>
                                  <blockquote className="border-l-2 border-violet-300 pl-3 text-[13px] italic text-muted-foreground line-clamp-3 leading-relaxed">
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
        )}

        {/* Library */}
        {answer === null && (

          <>
            {themeChips.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => setActiveTheme("__all__")}
                  className={cn(
                    "px-5 h-10 rounded-full text-sm font-medium transition-colors",
                    activeTheme === "__all__"
                      ? "bg-foreground text-background"
                      : "bg-muted text-foreground hover:bg-muted/70",
                  )}
                >
                  All Stories
                </button>
                {themeChips.map((t) => (
                  <button
                    key={t}
                    onClick={() => setActiveTheme(t)}
                    className={cn(
                      "px-5 h-10 rounded-full text-sm font-medium transition-colors capitalize",
                      activeTheme === t
                        ? "bg-foreground text-background"
                        : "bg-muted text-muted-foreground hover:bg-muted/70 hover:text-foreground",
                    )}
                  >
                    {t}
                  </button>
                ))}
              </div>
            )}

            {loading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading…
              </div>
            ) : filtered.length === 0 ? (
              <Card className="p-12 text-center text-sm text-muted-foreground">
                {videos.length === 0
                  ? "This organization hasn't shared any videos publicly yet."
                  : "No stories match your filters."}
              </Card>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-5">
                {filtered.map((v) => {
                  const isPlaying = playingId === v.id;
                  return (
                    <div key={v.id} className="space-y-3 group">
                      <div className="relative aspect-[9/16] rounded-2xl overflow-hidden bg-muted">
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
                              <div className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">
                                VIDEO THUMBNAIL
                              </div>
                            )}
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
                          </button>
                        )}
                      </div>
                      <Link to={`/org/${slug}/content/videos/${v.id}`} className="block space-y-1 px-0.5">
                        <div className="font-semibold text-sm line-clamp-2 leading-snug hover:underline">
                          {v.title ?? "Untitled"}
                        </div>
                        {v.short_description ? (
                          <div className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                            {v.short_description}
                          </div>
                        ) : null}
                      </Link>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
