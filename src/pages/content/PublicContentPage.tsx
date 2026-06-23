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
  youtube_id: string;
  duration_seconds: number | null;
}

interface VideoTheme {
  video_id: string;
  themes: string[];
}

interface SearchHit {
  video_id: string;
  chunk_id: string;
  title: string;
  thumbnail_url: string | null;
  channel_name: string | null;
  snippet: string;
  start_seconds: number;
  similarity: number;
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
  const [query, setQuery] = useState("");
  const [videos, setVideos] = useState<PublicVideo[]>([]);
  const [videoThemes, setVideoThemes] = useState<Record<string, string[]>>({});
  const [activeTheme, setActiveTheme] = useState<string>("__all__");
  const [orgName, setOrgName] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [openCategory, setOpenCategory] = useState<CategoryKey | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchHits, setSearchHits] = useState<SearchHit[] | null>(null);
  const [activeQuery, setActiveQuery] = useState<string>("");

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
          .select("id, title, thumbnail_url, channel_name, youtube_id, duration_seconds")
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
    try {
      const { data, error } = await supabase.functions.invoke("content-search", {
        body: { query: q, orgSlug: slug, public: true },
      });
      if (error) throw error;
      setSearchHits(((data as any)?.results ?? []) as SearchHit[]);
    } catch {
      setSearchHits([]);
    } finally {
      setSearching(false);
    }
  };

  const clearSearch = () => {
    setSearchHits(null);
    setActiveQuery("");
    setQuery("");
  };

  return (
    <div className="h-screen overflow-y-auto bg-background">
      <div className="container max-w-6xl py-12 px-6 space-y-10">
        {/* AI Hero */}
        <section className="text-center space-y-5 pt-6">
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

        {/* Search results */}
        {searchHits !== null && (
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">
                {searchHits.length} {searchHits.length === 1 ? "result" : "results"} for
                <span className="text-muted-foreground font-normal"> "{activeQuery}"</span>
              </h2>
              <Button variant="ghost" size="sm" onClick={clearSearch}>
                <X className="h-4 w-4 mr-1" /> Clear
              </Button>
            </div>
            {searching ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Searching…
              </div>
            ) : searchHits.length === 0 ? (
              <Card className="p-8 text-center text-sm text-muted-foreground">
                No matches found. Try rephrasing your question.
              </Card>
            ) : (
              <div className="grid gap-3">
                {searchHits.map((h) => (
                  <Link
                    key={h.chunk_id}
                    to={`/org/${slug}/content/videos/${h.video_id}?t=${Math.floor(h.start_seconds)}`}
                    className="flex gap-4 p-3 rounded-xl border hover:border-foreground/20 hover:bg-muted/40 transition-colors"
                  >
                    {h.thumbnail_url && (
                      <img
                        src={h.thumbnail_url}
                        alt=""
                        className="w-28 h-20 object-cover rounded-lg shrink-0"
                      />
                    )}
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="font-medium text-foreground line-clamp-1">{h.title}</span>
                        <span>·</span>
                        <span>{formatTimestamp(h.start_seconds)}</span>
                      </div>
                      <p className="text-sm line-clamp-2">{h.snippet}</p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Library */}
        {searchHits === null && (
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
                        {v.channel_name && (
                          <div className="text-xs text-muted-foreground line-clamp-1">
                            {v.channel_name}
                          </div>
                        )}
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
