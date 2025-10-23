import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface TwilioPhoneNumber {
  id: string;
  organization_id: string;
  phone_number: string;
  friendly_name: string | null;
  sid: string;
  capabilities: {
    voice: boolean;
    sms: boolean;
    mms: boolean;
  };
  is_primary: boolean;
  assigned_to_user_id: string | null;
  status: string;
  provisioned_at: string;
  released_at: string | null;
  created_at: string;
  updated_at: string;
}

export const useTwilioNumbers = () => {
  const queryClient = useQueryClient();

  const { data: numbers = [], isLoading } = useQuery({
    queryKey: ["twilio-numbers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("twilio_phone_numbers")
        .select("*")
        .eq("status", "active")
        .order("is_primary", { ascending: false })
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as TwilioPhoneNumber[];
    },
  });

  const provisionNumber = useMutation({
    mutationFn: async ({
      areaCode,
      friendlyName,
      isPrimary,
      organizationId,
    }: {
      areaCode: string;
      friendlyName?: string;
      isPrimary?: boolean;
      organizationId?: string;
    }) => {
      const { data, error } = await supabase.functions.invoke(
        "twilio-provision-number",
        {
          body: { areaCode, friendlyName, isPrimary, organizationId },
        }
      );

      if (error) throw error;
      if (!data.success) throw new Error(data.error);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["twilio-numbers"] });
      toast.success("Phone number provisioned successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to provision number: ${error.message}`);
    },
  });

  const releaseNumber = useMutation({
    mutationFn: async (phoneNumberId: string) => {
      const { data, error } = await supabase.functions.invoke(
        "twilio-release-number",
        {
          body: { phoneNumberId },
        }
      );

      if (error) throw error;
      if (!data.success) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["twilio-numbers"] });
      toast.success("Phone number released successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to release number: ${error.message}`);
    },
  });

  const assignNumber = useMutation({
    mutationFn: async ({
      phoneNumberId,
      userId,
    }: {
      phoneNumberId: string;
      userId: string | null;
    }) => {
      const { data, error } = await supabase.functions.invoke(
        "twilio-assign-number",
        {
          body: { phoneNumberId, userId },
        }
      );

      if (error) throw error;
      if (!data.success) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["twilio-numbers"] });
      toast.success("Phone number assignment updated");
    },
    onError: (error: Error) => {
      toast.error(`Failed to assign number: ${error.message}`);
    },
  });

  return {
    numbers,
    isLoading,
    provisionNumber,
    releaseNumber,
    assignNumber,
  };
};