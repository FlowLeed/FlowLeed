import { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";

export default function PublicFormRedirect() {
  const { slug } = useParams();
  const nav = useNavigate();

  useEffect(() => {
    if (!slug) return;
    (async () => {
      try {
        const projectId = (import.meta as any).env.VITE_SUPABASE_PROJECT_ID;
        const anon = (import.meta as any).env.VITE_SUPABASE_PUBLISHABLE_KEY;
        const url = `https://${projectId}.supabase.co/functions/v1/public-form-get?slug=${encodeURIComponent(slug)}`;
        const res = await fetch(url, { headers: { apikey: anon, Authorization: `Bearer ${anon}` } });
        if (!res.ok) {
          nav("/", { replace: true });
          return;
        }
        const payload = await res.json();
        const orgSlug = payload?.organization?.slug;
        const formSlug = payload?.form?.slug;
        if (orgSlug && formSlug) {
          nav(`/${orgSlug}/f/${formSlug}`, { replace: true });
        } else {
          nav("/", { replace: true });
        }
      } catch {
        nav("/", { replace: true });
      }
    })();
  }, [slug, nav]);

  return (
    <div className="h-screen flex items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
}
