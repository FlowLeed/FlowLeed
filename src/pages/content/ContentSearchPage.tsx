import { useEffect, useState } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { Search, Loader2, ArrowLeft } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import { formatTimestamp } from "@/lib/contentUtils";

interface SearchResult {
  video_id: string;
  chunk_id: string;
  title: string;
  thumbnail_url: string | null;
  channel_name: string | null;
  snippet: string;
  start_seconds: number;
  similarity: number;
}

export default function ContentSearchPage() {
  const { organization } = useProfile();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const initial = params.get("q") ?? "";
  const [query, setQuery] = useState(initial);
  const [results, setResults] = useState<SearchResult[]>([]);

  const search = useMutation({
    mutationFn: async (q: string) => {
      if (!organization?.id) throw new Error("No organization");
      const { data, error } = await supabase.functions.invoke("content-search", {
        body: { query: q, organizationId: organization.id },
      });
      if (error) throw error;
      return (data as { results: SearchResult[] }).results;
    },
    onSuccess: (r) => setResults(r),
  });

  useEffect(() => {
    if (initial && organization?.id) search.mutate(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organization?.id]);

  return (
    <div className="container max-w-4xl py-10 px-6 space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-light">Semantic search</h1>
        <p className="text-muted-foreground">Find moments by meaning, not just keywords.</p>
      </header>

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!query.trim()) return;
          setParams({ q: query.trim() });
          search.mutate(query.trim());
        }}
      >
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-12 pl-10"
            placeholder="Try: stories about doubt and renewal…"
          />
        </div>
        <Button type="submit" disabled={search.isPending || !query.trim()} className="h-12 px-6">
          {search.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Search"}
        </Button>
      </form>

      {search.isPending && <div className="text-sm text-muted-foreground">Searching…</div>}
      {!search.isPending && results.length === 0 && initial && (
        <div className="text-sm text-muted-foreground">No matches yet — try rephrasing.</div>
      )}

      <div className="space-y-4">
        {results.map((r) => (
          <Link key={r.chunk_id} to={`/content/videos/${r.video_id}?t=${r.start_seconds}`}>
            <Card className="p-4 hover:shadow-md transition-shadow">
              <div className="flex gap-4">
                {r.thumbnail_url && (
                  <img src={r.thumbnail_url} alt="" className="w-32 h-20 object-cover rounded flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    <div className="font-medium truncate">{r.title}</div>
                    <Badge variant="outline" className="text-xs">
                      {formatTimestamp(r.start_seconds)}
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                      {Math.round(r.similarity * 100)}%
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground">{r.channel_name}</div>
                  <p className="text-sm line-clamp-2 mt-1">{r.snippet}</p>
                </div>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
