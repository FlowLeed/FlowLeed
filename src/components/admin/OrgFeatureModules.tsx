import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { FEATURE_MODULES, type FeatureKey } from "@/lib/features";
import { useOrgFeaturesFor } from "@/hooks/useOrgFeatures";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { Blocks } from "lucide-react";

interface Props {
  organizationId: string;
}

export const OrgFeatureModules: React.FC<Props> = ({ organizationId }) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { overrides, isLoading } = useOrgFeaturesFor(organizationId);

  const handleToggle = async (key: FeatureKey, enabled: boolean) => {
    const { error } = await supabase
      .from("organization_features")
      .upsert(
        {
          organization_id: organizationId,
          feature_key: key,
          enabled,
          updated_by_user_id: user?.id ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "organization_id,feature_key" }
      );

    if (error) {
      toast.error("Failed to update feature", { description: error.message });
      return;
    }
    toast.success(`${enabled ? "Enabled" : "Disabled"} ${key}`);
    queryClient.invalidateQueries({ queryKey: ["org-features", organizationId] });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Blocks className="h-4 w-4" />
          Feature Modules
        </CardTitle>
        <CardDescription>
          Enable or disable specific product modules for this organization. Disabled
          modules are hidden from navigation and inaccessible to all of the org's users.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <>
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </>
        ) : (
          FEATURE_MODULES.map((mod) => {
            const enabled = overrides[mod.key] !== false; // default true
            return (
              <div
                key={mod.key}
                className="flex items-start justify-between gap-4 rounded-lg border p-4"
              >
                <div className="flex items-start gap-3 min-w-0">
                  <mod.icon className="h-5 w-5 mt-0.5 text-muted-foreground flex-shrink-0" />
                  <div className="min-w-0">
                    <div className="font-medium">{mod.label}</div>
                    <div className="text-sm text-muted-foreground">
                      {mod.description}
                    </div>
                  </div>
                </div>
                <Switch
                  checked={enabled}
                  onCheckedChange={(v) => handleToggle(mod.key, v)}
                />
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
};
