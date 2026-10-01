import { useMutation, useQuery } from "@tanstack/react-query";
import { getGroupDetails, submitGroupSignup } from "@/api/groupSignup";

export const useGroupDetails = (token: string | undefined) =>
  useQuery({
    queryKey: ["group-signup-details", token],
    queryFn: () => getGroupDetails(token!),
    enabled: !!token,
    // A missing or closed group won't appear on a retry.
    retry: false,
  });

export const useSubmitGroupSignup = () =>
  useMutation({ mutationFn: submitGroupSignup });
