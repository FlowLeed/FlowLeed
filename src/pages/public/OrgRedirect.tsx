import { useParams, Navigate } from "react-router-dom";

// Redirect legacy /org/:slug/... paths to canonical /:slug/...
export function OrgContentRedirect() {
  const { slug } = useParams();
  return <Navigate to={`/${slug}/content`} replace />;
}

export function OrgContentVideoRedirect() {
  const { slug, id } = useParams();
  return <Navigate to={`/${slug}/content/videos/${id}`} replace />;
}

export function OrgGroupsRedirect() {
  const { slug } = useParams();
  return <Navigate to={`/${slug}/groups`} replace />;
}
