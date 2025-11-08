import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface OwnerOnboardingProgress {
  first_flow_created: boolean;
  pco_connected: boolean;
  pco_lists_mapped: boolean;
  team_members_invited: boolean;
  flow_owners_assigned: boolean;
}

export interface OwnerOnboardingState {
  progress: OwnerOnboardingProgress;
  currentStep: number;
  totalSteps: number;
  completedSteps: number;
  isCompleted: boolean;
  isLoading: boolean;
  updateProgress: (step: keyof OwnerOnboardingProgress, value: boolean) => Promise<void>;
  completeOnboarding: () => Promise<void>;
}

export const useOrgOwnerOnboarding = (organizationId: string | undefined) => {
  const { toast } = useToast();
  const [progress, setProgress] = useState<OwnerOnboardingProgress>({
    first_flow_created: false,
    pco_connected: false,
    pco_lists_mapped: false,
    team_members_invited: false,
    flow_owners_assigned: false,
  });
  const [isCompleted, setIsCompleted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const totalSteps = 5;
  const completedSteps = Object.values(progress).filter(Boolean).length;
  const currentStep = completedSteps + 1;

  useEffect(() => {
    if (!organizationId) return;

    const fetchOnboardingProgress = async () => {
      try {
        const { data, error } = await supabase
          .from("organizations")
          .select("onboarding_progress, onboarding_completed")
          .eq("id", organizationId)
          .single();

        if (error) throw error;

        if (data) {
          const progressData = data.onboarding_progress as unknown as OwnerOnboardingProgress;
          const currentProgress = progressData || {
            first_flow_created: false,
            pco_connected: false,
            pco_lists_mapped: false,
            team_members_invited: false,
            flow_owners_assigned: false,
          };
          
          // Auto-detect if PCO lists are mapped (safety check)
          if (!currentProgress.pco_lists_mapped) {
            const { data: mappings } = await supabase
              .from("integration_list_mappings")
              .select("id")
              .limit(1);
            
            if (mappings && mappings.length > 0) {
              // Silently update the progress without toast
              currentProgress.pco_lists_mapped = true;
              await supabase
                .from("organizations")
                .update({ onboarding_progress: currentProgress as any })
                .eq("id", organizationId);
            }
          }
          
          setProgress(currentProgress);
          setIsCompleted(data.onboarding_completed || false);
        }
      } catch (error) {
        console.error("Error fetching onboarding progress:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchOnboardingProgress();
  }, [organizationId]);

  const updateProgress = async (step: keyof OwnerOnboardingProgress, value: boolean) => {
    if (!organizationId) return;

    const newProgress = { ...progress, [step]: value };
    setProgress(newProgress);

    try {
      const { error } = await supabase
        .from("organizations")
        .update({ onboarding_progress: newProgress as any })
        .eq("id", organizationId);

      if (error) throw error;

      if (value) {
        toast({
          title: "Progress Updated!",
          description: "You're one step closer to completing your onboarding.",
        });
      }

      // Auto-complete if all steps are done
      const allCompleted = Object.values(newProgress).every(Boolean);
      if (allCompleted && !isCompleted) {
        await completeOnboarding();
      }
    } catch (error) {
      console.error("Error updating onboarding progress:", error);
      toast({
        title: "Error",
        description: "Failed to update onboarding progress.",
        variant: "destructive",
      });
    }
  };

  const completeOnboarding = async () => {
    if (!organizationId) return;

    try {
      const { error } = await supabase
        .from("organizations")
        .update({ onboarding_completed: true })
        .eq("id", organizationId);

      if (error) throw error;

      setIsCompleted(true);
    } catch (error) {
      console.error("Error completing onboarding:", error);
    }
  };

  return {
    progress,
    currentStep,
    totalSteps,
    completedSteps,
    isCompleted,
    isLoading,
    updateProgress,
    completeOnboarding,
  };
};
