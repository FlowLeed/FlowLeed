import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Task {
  id: string;
  title: string;
  description: string | null;
  contact_id: string | null;
  due_at: string | null;
  completed_at: string | null;
  created_at: string;
  contact?: { id: string; name: string } | null;
}

const db = supabase as any;

export const useTasks = (userId: string | undefined) =>
  useQuery({
    queryKey: ["tasks", userId],
    enabled: !!userId,
    queryFn: async (): Promise<Task[]> => {
      const { data, error } = await db
        .from("tasks")
        .select("id, title, description, contact_id, due_at, completed_at, created_at, contact:contacts(id, name)")
        .eq("assigned_to_user_id", userId)
        .order("completed_at", { ascending: false, nullsFirst: true })
        .order("due_at", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

export const useTaskMutations = (userId: string | undefined) => {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["tasks", userId] });
  const toggle = useMutation({
    mutationFn: async (t: Task) => {
      const { error } = await db.from("tasks").update({ completed_at: t.completed_at ? null : new Date().toISOString() }).eq("id", t.id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from("tasks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
  const create = useMutation({
    mutationFn: async (input: { organization_id: string; title: string; description?: string | null; due_at?: string | null; contact_id?: string | null }) => {
      const { error } = await db.from("tasks").insert({ ...input, assigned_to_user_id: userId, created_by_user_id: userId });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
  return { toggle, remove, create };
};
