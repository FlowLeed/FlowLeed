import { Navigate } from "react-router-dom";
import { useOrgFeatures } from "@/hooks/useOrgFeatures";
import type { FeatureKey } from "@/lib/features";

interface FeatureGateProps {
  feature: FeatureKey;
  children: React.ReactNode;
  redirectTo?: string;
}

/** Wraps a route/page; redirects when the feature is disabled for the org. */
export const FeatureGate: React.FC<FeatureGateProps> = ({
  feature,
  children,
  redirectTo = "/",
}) => {
  const { isEnabled, isLoading } = useOrgFeatures();
  if (isLoading) return null;
  if (!isEnabled(feature)) return <Navigate to={redirectTo} replace />;
  return <>{children}</>;
};
