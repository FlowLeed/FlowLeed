import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { FLOW_TEMPLATES } from "@/lib/flowTemplates";
import { useFlowContext } from "@/contexts/FlowContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
}

/**
 * Lets the user pick which starter flows to create. Nothing is created
 * automatically for new organizations — this is the explicit opt-in.
 */
export const FlowTemplatePicker = ({ open, onOpenChange, onCreated }: Props) => {
  const { createFlow } = useFlowContext();
  const { toast } = useToast();
  const [selected, setSelected] = useState<string[]>(
    FLOW_TEMPLATES.filter((t) => t.recommended).map((t) => t.key)
  );
  const [creating, setCreating] = useState(false);

  const toggle = (key: string) =>
    setSelected((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));

  const handleCreate = async () => {
    if (selected.length === 0) return;
    setCreating(true);
    let created = 0;
    try {
      for (const template of FLOW_TEMPLATES.filter((t) => selected.includes(t.key))) {
        const flowId = await createFlow({
          name: template.name,
          icon: template.icon,
          flow_type: "linear",
          stages: template.stages.map((s) => ({
            id: "",
            name: s.name,
            contacts: [],
            color: s.color,
            isStartStep: s.isStartStep || false,
            isEndStep: s.isEndStep || false,
          })),
        } as any);
        created += 1;
        if (flowId) {
          await supabase
            .from("pipelines")
            .update({ description: template.description })
            .eq("id", flowId);
        }
      }
      toast({
        title: created === 1 ? "Flow created" : `${created} flows created`,
        description: "You can rename stages or add steps any time.",
      });
      onCreated?.();
      onOpenChange(false);
    } catch (error) {
      toast({
        title: "Couldn't create flows",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Start from a template</DialogTitle>
          <DialogDescription>
            Pick the flows your church actually runs. You can add more later or build your own.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          {FLOW_TEMPLATES.map((template) => {
            const checked = selected.includes(template.key);
            return (
              <label
                key={template.key}
                className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                  checked ? "border-primary bg-accent/50" : "hover:bg-accent/30"
                }`}
              >
                <Checkbox
                  checked={checked}
                  onCheckedChange={() => toggle(template.key)}
                  className="mt-0.5"
                />
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{template.name}</span>
                    {template.recommended && (
                      <Badge variant="secondary" className="text-[10px]">
                        Recommended
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{template.description}</p>
                  <p className="text-[11px] text-muted-foreground/80">
                    {template.stages.length} steps · {template.stages.map((s) => s.name).join(" → ")}
                  </p>
                </div>
              </label>
            );
          })}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={creating || selected.length === 0}>
            {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {selected.length === 0
              ? "Select flows"
              : `Create ${selected.length} flow${selected.length === 1 ? "" : "s"}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
