import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

interface SignupRequest {
  id: string;
  group_id: string;
  name: string;
  email: string;
  phone: string | null;
  notes: string | null;
  status: string;
  contact_id: string | null;
  created_at: string;
  processed_at: string | null;
  processed_by_user_id: string | null;
}

export const useGroupSignupRequests = (groupId: string | undefined) => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ["group-signup-requests", groupId],
    queryFn: async () => {
      if (!groupId) return [];
      
      const { data, error } = await supabase
        .from("group_signup_requests")
        .select("*")
        .eq("group_id", groupId)
        .eq("status", "pending")
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data as SignupRequest[];
    },
    enabled: !!groupId,
  });

  const approveRequest = useMutation({
    mutationFn: async ({ 
      request, 
      organizationId 
    }: { 
      request: SignupRequest; 
      organizationId: string;
    }) => {
      let contactId = request.contact_id;

      // Create contact if it doesn't exist
      if (!contactId) {
        const { data: newContact, error: contactError } = await supabase
          .from("contacts")
          .insert({
            organization_id: organizationId,
            name: request.name,
            email: request.email,
            phone: request.phone,
            source_type: "group_signup",
          })
          .select("id")
          .single();

        if (contactError) throw contactError;
        contactId = newContact.id;

        // Update request with contact_id
        await supabase
          .from("group_signup_requests")
          .update({ contact_id: contactId })
          .eq("id", request.id);
      }

      // Add as group member
      const { error: memberError } = await supabase
        .from("group_members")
        .insert({
          group_id: request.group_id,
          contact_id: contactId,
          role: "member",
          status: "active",
        });

      if (memberError) throw memberError;

      // Update request status
      const { error: updateError } = await supabase
        .from("group_signup_requests")
        .update({
          status: "approved",
          processed_at: new Date().toISOString(),
          processed_by_user_id: user?.id,
        })
        .eq("id", request.id);

      if (updateError) throw updateError;

      return contactId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["group-signup-requests", groupId] });
      queryClient.invalidateQueries({ queryKey: ["group-members", groupId] });
      queryClient.invalidateQueries({ queryKey: ["groups"] });
      toast.success("Request approved and member added");
    },
    onError: (error) => {
      console.error("Error approving request:", error);
      toast.error("Failed to approve request");
    },
  });

  const rejectRequest = useMutation({
    mutationFn: async (requestId: string) => {
      const { error } = await supabase
        .from("group_signup_requests")
        .update({
          status: "rejected",
          processed_at: new Date().toISOString(),
          processed_by_user_id: user?.id,
        })
        .eq("id", requestId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["group-signup-requests", groupId] });
      toast.success("Request rejected");
    },
    onError: (error) => {
      console.error("Error rejecting request:", error);
      toast.error("Failed to reject request");
    },
  });

  return {
    requests,
    isLoading,
    pendingCount: requests.length,
    approveRequest,
    rejectRequest,
  };
};
