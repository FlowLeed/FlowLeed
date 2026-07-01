import { useEffect } from "react";
import { useLocation } from "react-router-dom";

export function useGoogleAnalyticsPageView() {
  const location = useLocation();

  useEffect(() => {
    if (typeof window === "undefined" || !window.gtag) return;

    window.gtag("event", "page_view", {
      page_path: location.pathname + location.search,
      page_location: window.location.href,
      page_title: document.title,
    });
  }, [location]);
}
