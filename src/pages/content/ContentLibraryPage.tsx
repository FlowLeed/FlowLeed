import { Link, useNavigate } from "react-router-dom";
import { Loader2, AlertCircle, Star } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useContentVideos } from "@/hooks/useContent";
import { formatTimestamp } from "@/lib/contentUtils";
import { Header } from "@/components/layout/Header";

export default function ContentLibraryPage() {
  const { data: videos = [], isLoading } = useContentVideos();
  const navigate = useNavigate();
  return (
    <div className="flex flex-col h-full">
      <Header
        title="Library"
        showFlowIcon={false}
        showAddButton={false}
        showBackButton
        onBackClick={() => navigate(-1)}
      />
      <div className="flex-1 overflow-y-auto">
        <div className="container max-w-5xl py-10 px-6 space-y-6">
          <header>
            <h1 className="text-3xl font-light">Library</h1>
            <p className="text-muted-foreground text-sm">{videos.length} video{videos.length === 1 ? "" : "s"}</p>
          </header>
          {isLoading ? (
            <div className="text-sm text-muted-foreground">Loading…</div>
          ) : (
            <div className="space-y-2">
              {videos.map((v) => (
                <Link to={`/content/videos/${v.id}`} key={v.id}>
                  <Card className="p-3 flex gap-3 hover:shadow-sm transition-shadow">
                    {v.thumbnail_url && (
                      <div className="relative w-28 h-16 flex-shrink-0">
                        <img src={v.thumbnail_url} alt="" className="w-full h-full object-cover rounded" />
                        {v.is_featured && (
                          <div
                            className="absolute top-1 left-1 h-5 w-5 rounded-full bg-amber-500 text-white flex items-center justify-center shadow"
                            title="Featured"
                          >
                            <Star className="h-3 w-3 fill-current" />
                          </div>
                        )}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{v.title}</div>
                      {v.short_description ? (
                        <div className="text-xs text-muted-foreground line-clamp-1 italic">{v.short_description}</div>
                      ) : (
                        <div className="text-xs text-muted-foreground truncate">{v.channel_name}</div>
                      )}
                      <div className="flex items-center gap-2 mt-1">
                        {v.ingest_status !== "ready" && v.ingest_status !== "failed" && (
                          <Badge variant="secondary" className="text-xs gap-1">
                            <Loader2 className="h-3 w-3 animate-spin" /> {v.ingest_status}
                          </Badge>
                        )}
                        {v.ingest_status === "failed" && (
                          <Badge variant="destructive" className="text-xs gap-1">
                            <AlertCircle className="h-3 w-3" /> Failed
                          </Badge>
                        )}
                        {v.duration_seconds != null && (
                          <span className="text-xs text-muted-foreground">{formatTimestamp(v.duration_seconds)}</span>
                        )}
                        <Badge variant="outline" className="text-xs ml-auto">
                          {v.consent_level === "public_search" ? "Public" : "Internal"}
                        </Badge>
                      </div>
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
