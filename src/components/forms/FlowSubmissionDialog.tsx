import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export interface FlowFormSubmission {
  id: string;
  formId: string;
  formName: string;
  contactId: string;
  createdAt: string;
  data: Record<string, unknown>;
  fields: Array<{ key: string; label: string; sortOrder: number }>;
}

interface FlowSubmissionDialogProps {
  contactName: string;
  submissions: FlowFormSubmission[];
}

const showValue = (value: unknown) => {
  if (value === null || value === undefined || value === "") return "Not answered";
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
};

export function FlowSubmissionDialog({ contactName, submissions }: FlowSubmissionDialogProps) {
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState(submissions[0]?.id || "");

  useEffect(() => {
    if (!submissions.some((submission) => submission.id === selectedId)) {
      setSelectedId(submissions[0]?.id || "");
    }
  }, [selectedId, submissions]);

  const selected = submissions.find((submission) => submission.id === selectedId) || submissions[0];
  const answers = useMemo(() => {
    if (!selected) return [];
    const fieldLabels = new Map(selected.fields.map((field) => [field.key, field.label]));
    const orderedKeys = selected.fields.map((field) => field.key);
    const extraKeys = Object.keys(selected.data).filter((key) => !fieldLabels.has(key));
    return [...orderedKeys, ...extraKeys].map((key) => ({
      key,
      label: fieldLabels.get(key) || key.split("_").join(" "),
      value: showValue(selected.data[key]),
    }));
  }, [selected]);

  if (!selected) return null;

  const stopInteraction = (event: React.SyntheticEvent) => event.stopPropagation();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0 text-primary"
            aria-label={`View form submission for ${contactName}`}
            onPointerDown={stopInteraction}
            onClick={(event) => {
              stopInteraction(event);
              setOpen(true);
            }}
          >
            <ClipboardList className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>View form submission</TooltipContent>
      </Tooltip>

      <DialogContent className="max-w-2xl p-0" onPointerDown={stopInteraction}>
        <DialogHeader className="border-b px-5 py-4 pr-12 text-left sm:px-6">
          <DialogTitle>{selected.formName}</DialogTitle>
          <DialogDescription>
            Submitted by {contactName} on {format(new Date(selected.createdAt), "MMM d, yyyy 'at' h:mm a")}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[70dvh] overflow-y-auto px-5 pb-5 sm:px-6 sm:pb-6">
          {submissions.length > 1 && (
            <div className="sticky top-0 z-10 -mx-5 mb-4 border-b bg-background px-5 py-3 sm:-mx-6 sm:px-6">
              <Select value={selected.id} onValueChange={setSelectedId}>
                <SelectTrigger aria-label="Choose form submission">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {submissions.map((submission) => (
                    <SelectItem key={submission.id} value={submission.id}>
                      {submission.formName} · {format(new Date(submission.createdAt), "MMM d, yyyy")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <dl className="divide-y">
            {answers.map((answer) => (
              <div key={answer.key} className="grid gap-1 py-3 sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)] sm:gap-5">
                <dt className="text-sm font-medium text-foreground">{answer.label}</dt>
                <dd className={`whitespace-pre-wrap break-words text-sm ${answer.value === "Not answered" ? "text-muted-foreground" : "text-foreground"}`}>
                  {answer.value}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </DialogContent>
    </Dialog>
  );
}