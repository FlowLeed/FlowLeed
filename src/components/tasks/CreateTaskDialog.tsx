import { useState } from "react";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";

interface CreateTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const INTERACTION_TYPES = [
  { value: "call", label: "Call" },
  { value: "email", label: "Email" },
  { value: "text", label: "Text" },
  { value: "visit", label: "Visit" },
  { value: "meeting", label: "Meeting" },
  { value: "other", label: "Other" },
];

export const CreateTaskDialog = ({ open, onOpenChange }: CreateTaskDialogProps) => {
  const { user } = useAuth();
  const { organization } = useProfile();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [contactSearch, setContactSearch] = useState("");
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [selectedContactName, setSelectedContactName] = useState("");
  const [subject, setSubject] = useState("");
  const [interactionType, setInteractionType] = useState("call");
  const [dueDate, setDueDate] = useState<Date>();
  const [notes, setNotes] = useState("");

  // Search contacts
  const { data: searchResults } = useQuery({
    queryKey: ["contact-search", contactSearch, organization?.id],
    queryFn: async () => {
      if (!contactSearch || contactSearch.length < 2 || !organization?.id) return [];
      const { data } = await supabase
        .from("contacts")
        .select("id, name, avatar")
        .eq("organization_id", organization.id)
        .ilike("name", `%${contactSearch}%`)
        .limit(8);
      return data || [];
    },
    enabled: !!contactSearch && contactSearch.length >= 2 && !!organization?.id,
  });

  const createTask = useMutation({
    mutationFn: async () => {
      if (!selectedContactId || !user?.id || !dueDate) throw new Error("Missing required fields");
      const { error } = await supabase.from("contact_interactions").insert({
        contact_id: selectedContactId,
        created_by_user_id: user.id,
        assigned_to_user_id: user.id,
        interaction_type: interactionType,
        subject: subject || "Follow up",
        details: notes || null,
        scheduled_at: dueDate.toISOString(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Task created", description: `Follow-up scheduled for ${selectedContactName}` });
      queryClient.invalidateQueries({ queryKey: ["all-scheduled-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["my-upcoming-tasks"] });
      resetForm();
      onOpenChange(false);
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const resetForm = () => {
    setContactSearch("");
    setSelectedContactId(null);
    setSelectedContactName("");
    setSubject("");
    setInteractionType("call");
    setDueDate(undefined);
    setNotes("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New Follow-Up Task</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Contact search */}
          <div className="space-y-2">
            <Label>Contact</Label>
            {selectedContactId ? (
              <div className="flex items-center justify-between p-2 border rounded-md">
                <span className="font-medium">{selectedContactName}</span>
                <Button variant="ghost" size="sm" onClick={() => { setSelectedContactId(null); setSelectedContactName(""); }}>
                  Change
                </Button>
              </div>
            ) : (
              <div className="relative">
                <Input
                  placeholder="Search contacts..."
                  value={contactSearch}
                  onChange={(e) => setContactSearch(e.target.value)}
                />
                {searchResults && searchResults.length > 0 && (
                  <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-popover border rounded-md shadow-md max-h-48 overflow-y-auto">
                    {searchResults.map((c) => (
                      <button
                        key={c.id}
                        className="w-full text-left px-3 py-2 hover:bg-muted text-sm"
                        onClick={() => {
                          setSelectedContactId(c.id);
                          setSelectedContactName(c.name);
                          setContactSearch("");
                        }}
                      >
                        {c.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Subject */}
          <div className="space-y-2">
            <Label>Subject</Label>
            <Input placeholder="Follow up about..." value={subject} onChange={(e) => setSubject(e.target.value)} />
          </div>

          {/* Type */}
          <div className="space-y-2">
            <Label>Type</Label>
            <Select value={interactionType} onValueChange={setInteractionType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {INTERACTION_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Due date */}
          <div className="space-y-2">
            <Label>Due Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn("w-full justify-start text-left font-normal", !dueDate && "text-muted-foreground")}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dueDate ? format(dueDate, "PPP") : "Pick a date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dueDate}
                  onSelect={setDueDate}
                  disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label>Notes (optional)</Label>
            <Textarea placeholder="Any notes..." value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={() => createTask.mutate()}
            disabled={!selectedContactId || !dueDate || createTask.isPending}
          >
            {createTask.isPending ? "Creating..." : "Create Task"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
