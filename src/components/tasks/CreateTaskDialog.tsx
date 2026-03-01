import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { FlowSelectionStep } from "@/components/contact/FlowSelectionStep";
import { StageSelectionStep } from "@/components/contact/StageSelectionStep";
import { ArrowLeft, Search } from "lucide-react";

interface CreateTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface Pipeline {
  id: string;
  name: string;
  description?: string;
  icon?: string;
}

interface Stage {
  id: string;
  name: string;
  color?: string;
  stage_order: number;
  default_assignee_user_id?: string | null;
}

type Step = "contact" | "pipeline" | "stage";

export const CreateTaskDialog = ({ open, onOpenChange }: CreateTaskDialogProps) => {
  const { user } = useAuth();
  const { organization } = useProfile();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [step, setStep] = useState<Step>("contact");
  const [contactSearch, setContactSearch] = useState("");
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [selectedContactName, setSelectedContactName] = useState("");
  const [selectedPipeline, setSelectedPipeline] = useState<Pipeline | null>(null);

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

  // Fetch pipelines
  const { data: pipelines, isLoading: loadingPipelines } = useQuery({
    queryKey: ["task-pipelines"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pipelines")
        .select("id, name, description, icon")
        .order("name");
      if (error) throw error;
      return data as Pipeline[];
    },
    enabled: step === "pipeline",
  });

  // Fetch stages for selected pipeline
  const { data: stages, isLoading: loadingStages } = useQuery({
    queryKey: ["task-pipeline-stages", selectedPipeline?.id],
    queryFn: async () => {
      if (!selectedPipeline) return [];
      const { data, error } = await supabase
        .from("pipeline_stages")
        .select("id, name, color, stage_order, default_assignee_user_id")
        .eq("pipeline_id", selectedPipeline.id)
        .order("stage_order");
      if (error) throw error;
      return data as Stage[];
    },
    enabled: !!selectedPipeline,
  });

  // Insert into pipeline_contacts
  const addToFlowMutation = useMutation({
    mutationFn: async (stage: Stage) => {
      if (!selectedContactId || !selectedPipeline || !user?.id) throw new Error("Missing data");

      const { error } = await supabase.from("pipeline_contacts").insert({
        contact_id: selectedContactId,
        pipeline_id: selectedPipeline.id,
        stage_id: stage.id,
        stage_order: stage.stage_order,
        assigned_to_user_id: user.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Added to flow",
        description: `${selectedContactName} added to ${selectedPipeline?.name}`,
      });
      queryClient.invalidateQueries({ queryKey: ["tasks-page-contacts"] });
      queryClient.invalidateQueries({ queryKey: ["pipelines"] });
      // Dispatch custom event for flow sync
      window.dispatchEvent(new CustomEvent("flow-assignment-updated"));
      handleClose();
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const handleClose = () => {
    setStep("contact");
    setContactSearch("");
    setSelectedContactId(null);
    setSelectedContactName("");
    setSelectedPipeline(null);
    onOpenChange(false);
  };

  const handleBack = () => {
    if (step === "stage") {
      setSelectedPipeline(null);
      setStep("pipeline");
    } else if (step === "pipeline") {
      setStep("contact");
    }
  };

  const stepTitle = () => {
    switch (step) {
      case "contact": return "Add to Flow — Select Contact";
      case "pipeline": return "Add to Flow — Select Flow";
      case "stage": return `Add to Flow — ${selectedPipeline?.name}`;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-3">
            {step !== "contact" && (
              <Button variant="ghost" size="sm" onClick={handleBack}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            <DialogTitle>{stepTitle()}</DialogTitle>
          </div>
        </DialogHeader>

        {/* Step 1: Search & select contact */}
        {step === "contact" && (
          <div className="space-y-3">
            <Label>Contact</Label>
            {selectedContactId ? (
              <div className="flex items-center justify-between p-3 border rounded-md">
                <span className="font-medium">{selectedContactName}</span>
                <Button variant="ghost" size="sm" onClick={() => { setSelectedContactId(null); setSelectedContactName(""); }}>
                  Change
                </Button>
              </div>
            ) : (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search contacts..."
                  value={contactSearch}
                  onChange={(e) => setContactSearch(e.target.value)}
                  className="pl-9"
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

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={handleClose}>Cancel</Button>
              <Button disabled={!selectedContactId} onClick={() => setStep("pipeline")}>
                Next
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Select flow */}
        {step === "pipeline" && (
          <>
            <FlowSelectionStep
              pipelines={pipelines || []}
              loading={loadingPipelines}
              onSelect={(pipeline) => {
                setSelectedPipeline(pipeline);
                setStep("stage");
              }}
            />
            <div className="flex justify-end pt-2">
              <Button variant="outline" onClick={handleClose}>Cancel</Button>
            </div>
          </>
        )}

        {/* Step 3: Select stage */}
        {step === "stage" && selectedPipeline && (
          <>
            <StageSelectionStep
              stages={stages || []}
              loading={loadingStages}
              onSelect={(stage) => addToFlowMutation.mutate(stage)}
              adding={addToFlowMutation.isPending}
            />
            <div className="flex justify-end pt-2">
              <Button variant="outline" onClick={handleClose}>Cancel</Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};
