import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface MemberOnboardingProgress {
  profile_completed: boolean;
  flows_reviewed: boolean;
  first_interaction: boolean;
}

export interface MemberOnboardingState {
  progress: MemberOnboardingProgress;
  currentStep: number;
  totalSteps: number;
  completedSteps: number;
  isCompleted: boolean;
  isDismissed: boolean;
  isLoading: boolean;
  updateProgress: (step: keyof MemberOnboardingProgress, value: boolean) => Promise<void>;
  completeOnboarding: () => Promise<void>;
  dismissOnboarding: () => Promise<void>;
}

export const useMemberOnboarding = (userId: string | undefined) => {
  const { toast } = useToast();
  const [progress, setProgress] = useState<MemberOnboardingProgress>({
    profile_completed: false,
    flows_reviewed: false,
    first_interaction: false,
  });
  const [isCompleted, setIsCompleted] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const totalSteps = 3;
  const completedSteps = Object.values(progress).filter(Boolean).length;
  const currentStep = completedSteps + 1;

  useEffect(() => {
    if (!userId) return;

    const fetchOnboardingProgress = async () => {
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("onboarding_progress, onboarding_completed, onboarding_dismissed")
          .eq("user_id", userId)
          .single();

        if (error) throw error;

        if (data) {
          const progressData = data.onboarding_progress as unknown as MemberOnboardingProgress;
          setProgress(progressData || {
            profile_completed: false,
            flows_reviewed: false,
            first_interaction: false,
          });
          setIsCompleted(data.onboarding_completed || false);
          setIsDismissed(data.onboarding_dismissed || false);
        }
      } catch (error) {
        console.error("Error fetching member onboarding progress:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchOnboardingProgress();
  }, [userId]);

  const updateProgress = async (step: keyof MemberOnboardingProgress, value: boolean) => {
    if (!userId) return;

    // Don't update if already at this value
    if (progress[step] === value) return;

    const newProgress = { ...progress, [step]: value };
    setProgress(newProgress);

    try {
      const { error } = await supabase
        .from("profiles")
        .update({ onboarding_progress: newProgress })
        .eq("user_id", userId);

      if (error) throw error;

      // Only show toast when completing a step (not if already completed)
      if (value && !progress[step]) {
        toast({
          title: "Step Completed!",
          description: "Great progress on your onboarding journey.",
        });
      }

      // Auto-complete if all steps are done
      const allCompleted = Object.values(newProgress).every(Boolean);
      if (allCompleted && !isCompleted) {
        await completeOnboarding();
      }
    } catch (error) {
      console.error("Error updating member onboarding progress:", error);
      toast({
        title: "Error",
        description: "Failed to update onboarding progress.",
        variant: "destructive",
      });
    }
  };

  const completeOnboarding = async () => {
    if (!userId) return;

    try {
      const { error } = await supabase
        .from("profiles")
        .update({ onboarding_completed: true })
        .eq("user_id", userId);

      if (error) throw error;

      setIsCompleted(true);
    } catch (error) {
      console.error("Error completing member onboarding:", error);
    }
  };

  const dismissOnboarding = async () => {
    if (!userId) return;

    try {
      const { error } = await supabase
        .from("profiles")
        .update({ onboarding_dismissed: true })
        .eq("user_id", userId);

      if (error) throw error;

      setIsDismissed(true);
    } catch (error) {
      console.error("Error dismissing onboarding:", error);
    }
  };

  return {
    progress,
    currentStep,
    totalSteps,
    completedSteps,
    isCompleted,
    isDismissed,
    isLoading,
    updateProgress,
    completeOnboarding,
    dismissOnboarding,
  };
};
