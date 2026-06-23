import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Search, Loader2, Film } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { formatTimestamp } from "@/lib/contentUtils";

interface PublicResult {
  video_id: string; chunk_id: string; title: string; thumbnail_url: string | null;
  channel_name: string | null; snippet: string; start_seconds: number; similarity: number;
}

interface PublicVideo {
  id: string; title: string | null; thumbnail_url: string | null; channel_name: string | null;
  youtube_id: string;
}

export default function PublicContentPage() {
  const { slug } = useParams<{ slug: string }>();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PublicResult[]>([]);
  const [videos, setVideos] = useState<PublicVideo[]>([]);
  const [loading, setLoading] = useState(false);
  const [orgName, setOrgName] = useState<string>("");

  useEffect(() => {
    const load = async () => {
      if (!slug) return;
      const { data: org } = await supabase.from("organizations")
        .select("id, name").eq("slug", slug).maybeSingle();
      if (org) {
        setOrgName(org.name);
        const { data } = await supabase.from("content_videos" as any)
          .select("id, title, thumbnail_url, channel_name, youtube_id")
          .eq("organization_id", org.id)
          .eq("consent_level", "public_search")
          .order("created_at", { ascending: false });
        setVideos((data as unknown as PublicVideo[]) ?? []);
      }
    };
    load();
  }, [slug]);

  const onSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || !slug) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("content-search", {
        body: { query: query.trim(), orgSlug: slug, public: true },
      });
      if (error) throw error;
      setResults((data as { results: PublicResult[] }).results);
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-background overflow-y-auto">
      <div className="container max-w-4xl py-12 px-6 space-y-10">
        <header className="space-y-2 text-center">
          <div className="text-sm text-muted-foreground inline-flex items-center gap-2 justify-center">
            <Film className="h-4 w-4" /> {orgName} · Content
          </div>
          <h1 className="text-4xl font-light">Search the library</h1>
          <p className="text-muted-foreground">Find the stories that matter, by meaning.</p>
        </header>

        <form onSubmit={onSearch} className="flex gap-2 max-w-2xl mx-auto">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by meaning…"
              className="h-12 pl-10"
            />
          </div>
          <Button type="submit" disabled={loading || !query.trim()} className="h-12 px-6">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Search"}
          </Button>
        </form>

        {results.length > 0 ? (
          <div className="space-y-3">
            {results.map((r) => (
              <Link key={r.chunk_id + "-c"} to={`/org/${slug}/content/videos/${r.video_id}?t=${Math.floor(r.start_seconds)}`}>
                <Card className="p-4 flex gap-4 hover:shadow-md transition-shadow">
                  {r.thumbnail_url && (
                    <img src={r.thumbnail_url} alt="" className="w-32 h-20 object-cover rounded" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="font-medium truncate">{r.title}</div>
                      <Badge variant="outline" className="text-xs">{formatTimestamp(r.start_seconds)}</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground">{r.channel_name}</div>
                    <p className="text-sm line-clamp-2 mt-1">{r.snippet}</p>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          <section className="space-y-4">
            <h2 className="text-lg font-light">Recent videos</h2>
            {videos.length === 0 ? (
              <Card className="p-12 text-center text-sm text-muted-foreground">
                This organization hasn't shared any videos publicly yet.
              </Card>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {videos.map((v) => (
                  <Link key={v.id} to={`/org/${slug}/content/videos/${v.id}`}>
                    <Card className="overflow-hidden hover:shadow-md transition-shadow">
                      {v.thumbnail_url && (
                        <div className="aspect-video bg-muted">
                          <img src={v.thumbnail_url} alt="" className="w-full h-full object-cover" />
                        </div>
                      )}
                      <div className="p-3 space-y-1">
                        <div className="font-medium text-sm line-clamp-2">{v.title}</div>
                        <div className="text-xs text-muted-foreground">{v.channel_name}</div>
                      </div>
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
