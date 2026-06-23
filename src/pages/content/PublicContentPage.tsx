import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Search, Loader2, Play } from "lucide-react";
import { Input } from "@/components/ui/input";
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

export default function PublicContentPage() {
  const { slug } = useParams<{ slug: string }>();
  const [query, setQuery] = useState("");
  const [videos, setVideos] = useState<PublicVideo[]>([]);
  const [videoThemes, setVideoThemes] = useState<Record<string, string[]>>({});
  const [activeTheme, setActiveTheme] = useState<string>("__all__");
  const [orgName, setOrgName] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [playingId, setPlayingId] = useState<string | null>(null);


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
    const q = query.trim().toLowerCase();
    return videos.filter((v) => {
      if (activeTheme !== "__all__") {
        const themes = (videoThemes[v.id] ?? []).map((t) => t.trim().toLowerCase());
        if (!themes.includes(activeTheme)) return false;
      }
      if (q) {
        const hay = `${v.title ?? ""} ${v.channel_name ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [videos, videoThemes, activeTheme, query]);

  return (
    <div className="min-h-screen bg-background overflow-y-auto">
      <div className="container max-w-7xl py-10 px-6 space-y-8">
        <header className="space-y-1">
          <h1 className="text-4xl font-bold tracking-tight">Stories Library</h1>
          <p className="text-muted-foreground">
            {orgName ? `${orgName} · ` : ""}Manage and track your video stories
          </p>
        </header>

        <div className="relative max-w-xl">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search stories..."
            className="h-12 pl-11 rounded-full bg-muted border-0"
          />
        </div>

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
      </div>
    </div>
  );
}
