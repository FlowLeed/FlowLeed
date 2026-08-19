import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Papa from "papaparse";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Loader2,
  Undo2,
  Upload,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { downloadCsv, toCsv } from "@/lib/csvExport";
import {
  IGNORE_FIELD,
  IMPORT_FIELDS,
  MappedRow,
  RowProblem,
  SAMPLE_CSV_HEADERS,
  SAMPLE_CSV_ROWS,
  autoDetectMapping,
  buildImportTag,
  buildRows,
} from "@/lib/csvImport";

interface StageOption {
  id: string;
  name: string;
}

interface FlowOption {
  id: string;
  name: string;
  stages: StageOption[];
}

interface ImportContactsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId?: string | null;
  /** When provided, the import is locked to this flow (used inside a flow view). */
  lockedFlow?: FlowOption;
  defaultStageId?: string;
  onComplete?: () => void;
}

type Step = "upload" | "map" | "preview" | "result";

const MAX_ROWS = 10000;
const BATCH_SIZE = 100;

export const ImportContactsDialog: React.FC<ImportContactsDialogProps> = ({
  open,
  onOpenChange,
  organizationId,
  lockedFlow,
  defaultStageId,
  onComplete,
}) => {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>("upload");
  const [fileName, setFileName] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [records, setRecords] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});

  const [flows, setFlows] = useState<FlowOption[]>([]);
  const [pipelineId, setPipelineId] = useState<string>(lockedFlow?.id ?? "none");
  const [stageId, setStageId] = useState<string>(defaultStageId ?? "");
  const [addTag, setAddTag] = useState(true);
  const [importTag, setImportTag] = useState(buildImportTag());

  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{
    importId: string;
    created: number;
    updated: number;
    enrolled: number;
    skipped: number;
  } | null>(null);
  const [undoing, setUndoing] = useState(false);

  const reset = useCallback(() => {
    setStep("upload");
    setFileName("");
    setHeaders([]);
    setRecords([]);
    setMapping({});
    setPipelineId(lockedFlow?.id ?? "none");
    setStageId(defaultStageId ?? "");
    setAddTag(true);
    setImportTag(buildImportTag());
    setRunning(false);
    setProgress(0);
    setResult(null);
  }, [lockedFlow?.id, defaultStageId]);

  useEffect(() => {
    if (open) reset();
  }, [open, reset]);

  // Load flows for the "People" entry point
  useEffect(() => {
    if (!open || lockedFlow || !organizationId) return;
    (async () => {
      const { data } = await supabase
        .from("pipelines")
        .select("id,name,pipeline_stages(id,name,stage_order)")
        .eq("organization_id", organizationId)
        .order("name");
      setFlows(
        (data ?? []).map((p: any) => ({
          id: p.id,
          name: p.name,
          stages: (p.pipeline_stages ?? [])
            .sort((a: any, b: any) => a.stage_order - b.stage_order)
            .map((s: any) => ({ id: s.id, name: s.name })),
        })),
      );
    })();
  }, [open, lockedFlow, organizationId]);

  const activeFlow = useMemo(
    () => (lockedFlow ? lockedFlow : flows.find((f) => f.id === pipelineId)),
    [lockedFlow, flows, pipelineId],
  );

  useEffect(() => {
    if (activeFlow && !activeFlow.stages.some((s) => s.id === stageId)) {
      setStageId(activeFlow.stages[0]?.id ?? "");
    }
  }, [activeFlow, stageId]);

  const { rows, problems } = useMemo(() => {
    if (!records.length) return { rows: [] as MappedRow[], problems: [] as RowProblem[] };
    return buildRows(records, mapping);
  }, [records, mapping]);

  const mappedFieldCount = useMemo(
    () => Object.values(mapping).filter((v) => v && v !== IGNORE_FIELD).length,
    [mapping],
  );

  const hasNameMapping = useMemo(() => {
    const values = Object.values(mapping);
    return values.includes("first_name") || values.includes("last_name") || values.includes("full_name");
  }, [mapping]);

  const handleFile = (file: File) => {
    setFileName(file.name);
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: "greedy",
      transformHeader: (h) => h.trim(),
      complete: (res) => {
        const parsedHeaders = (res.meta.fields ?? []).filter(Boolean) as string[];
        if (!parsedHeaders.length) {
          toast.error("We couldn't find a header row in that file.");
          return;
        }
        const data = (res.data ?? []).slice(0, MAX_ROWS);
        if ((res.data ?? []).length > MAX_ROWS) {
          toast.warning(`Only the first ${MAX_ROWS.toLocaleString()} rows will be imported.`);
        }
        setHeaders(parsedHeaders);
        setRecords(data);
        setMapping(autoDetectMapping(parsedHeaders));
        setStep("map");
      },
      error: (err) => toast.error(`Could not read that file: ${err.message}`),
    });
  };

  const downloadTemplate = () => {
    downloadCsv("flowleed-import-template.csv", toCsv(SAMPLE_CSV_HEADERS, SAMPLE_CSV_ROWS));
  };

  const downloadSkipped = () => {
    if (!problems.length) return;
    downloadCsv(
      "skipped-rows.csv",
      toCsv(["Row", "Why it was skipped", ...headers], problems.map((p) => [
        String(p.rowNumber),
        p.reason,
        ...headers.map((h) => p.raw[h] ?? ""),
      ])),
    );
  };

  const runImport = async () => {
    if (!organizationId) {
      toast.error("No organization found.");
      return;
    }
    if (!rows.length) {
      toast.error("There are no valid rows to import.");
      return;
    }
    setRunning(true);
    setProgress(0);

    const tag = addTag && importTag.trim() ? importTag.trim() : null;
    const enroll = activeFlow && stageId ? { pipelineId: activeFlow.id, stageId } : null;

    try {
      const { data: startData, error: startErr } = await supabase.functions.invoke(
        "contacts-csv-import",
        {
          body: {
            action: "start",
            organizationId,
            fileName,
            totalRows: records.length,
            mapping,
            options: { addTag, hasProblems: problems.length },
            importTag: tag,
            pipelineId: enroll?.pipelineId ?? null,
            stageId: enroll?.stageId ?? null,
          },
        },
      );
      if (startErr || startData?.error) throw new Error(startData?.error ?? startErr?.message);
      const importId: string = startData.importId;

      const totals = { created: 0, updated: 0, enrolled: 0, skipped: 0 };
      for (let i = 0; i < rows.length; i += BATCH_SIZE) {
        const chunk = rows.slice(i, i + BATCH_SIZE);
        const { data, error } = await supabase.functions.invoke("contacts-csv-import", {
          body: { action: "batch", importId, rows: chunk },
        });
        if (error || data?.error) throw new Error(data?.error ?? error?.message);
        totals.created += data.created ?? 0;
        totals.updated += data.updated ?? 0;
        totals.enrolled += data.enrolled ?? 0;
        totals.skipped += data.skipped ?? 0;
        setProgress(Math.round(Math.min(i + BATCH_SIZE, rows.length) / rows.length * 100));
      }

      await supabase.functions.invoke("contacts-csv-import", {
        body: {
          action: "finish",
          importId,
          skippedRows: problems.map((p) => ({ rowNumber: p.rowNumber, reason: p.reason })),
        },
      });

      setResult({ importId, ...totals, skipped: totals.skipped + problems.length });
      setStep("result");
      queryClient.invalidateQueries({ queryKey: ["all-contacts"] });
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      window.dispatchEvent(new CustomEvent("flow-assignment-updated"));
      onComplete?.();
    } catch (e: any) {
      console.error("[import] failed", e);
      toast.error(`Import failed: ${e.message}`);
    } finally {
      setRunning(false);
    }
  };

  const undoImport = async () => {
    if (!result) return;
    setUndoing(true);
    try {
      const { data, error } = await supabase.functions.invoke("contacts-csv-import", {
        body: { action: "undo", importId: result.importId },
      });
      if (error || data?.error) throw new Error(data?.error ?? error?.message);
      toast.success(
        `Import undone — ${data.deleted} new ${data.deleted === 1 ? "person" : "people"} removed.`,
      );
      queryClient.invalidateQueries({ queryKey: ["all-contacts"] });
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      window.dispatchEvent(new CustomEvent("flow-assignment-updated"));
      onComplete?.();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(`Could not undo: ${e.message}`);
    } finally {
      setUndoing(false);
    }
  };

  const usedFields = new Set(Object.values(mapping).filter((v) => v && v !== IGNORE_FIELD));

  return (
    <Dialog open={open} onOpenChange={(v) => !running && onOpenChange(v)}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Import people from CSV
            {lockedFlow && <Badge variant="secondary">into {lockedFlow.name}</Badge>}
          </DialogTitle>
          <DialogDescription>
            {step === "upload" && "Upload a spreadsheet exported from anywhere — we'll match the columns for you."}
            {step === "map" && "Check how your columns line up with Flowleed fields."}
            {step === "preview" && "Review what will happen, then start the import."}
            {step === "result" && "Here's what changed."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto -mx-1 px-1">
          {/* STEP 1 — UPLOAD */}
          {step === "upload" && (
            <div className="space-y-4">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full border-2 border-dashed rounded-lg p-10 text-center hover:border-primary hover:bg-muted/40 transition-colors"
              >
                <Upload className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
                <p className="font-medium">Choose a CSV file</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Must include a header row. Up to {MAX_ROWS.toLocaleString()} rows.
                </p>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFile(file);
                  e.target.value = "";
                }}
              />
              <div className="rounded-lg bg-muted/50 p-4 text-sm space-y-2">
                <p className="font-medium">What we can import</p>
                <p className="text-muted-foreground">
                  Names, email, phone, address, birthday, gender, marital status, occupation, tags,
                  campus, assigned staff and a note. People already in Flowleed are matched by email
                  or phone and updated instead of duplicated — details synced from Planning Center are
                  never overwritten.
                </p>
                <Button variant="link" className="px-0 h-auto" onClick={downloadTemplate}>
                  <Download className="h-4 w-4 mr-1" />
                  Download a template CSV
                </Button>
              </div>
            </div>
          )}

          {/* STEP 2 — MAP */}
          {step === "map" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  <strong className="text-foreground">{fileName}</strong> — {records.length.toLocaleString()} rows,{" "}
                  {headers.length} columns
                </span>
                <Badge variant="secondary">{mappedFieldCount} mapped</Badge>
              </div>

              <ScrollArea className="h-[340px] rounded-lg border">
                <div className="divide-y">
                  {headers.map((header) => {
                    const sample = records.find((r) => (r[header] ?? "").toString().trim())?.[header] ?? "";
                    const value = mapping[header] ?? IGNORE_FIELD;
                    return (
                      <div key={header} className="flex items-center gap-3 p-3">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-sm truncate">{header}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {sample ? `e.g. ${sample}` : "no values"}
                          </p>
                        </div>
                        <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                        <Select
                          value={value}
                          onValueChange={(v) =>
                            setMapping((prev) => {
                              const next = { ...prev };
                              if (v !== IGNORE_FIELD) {
                                for (const k of Object.keys(next)) {
                                  if (k !== header && next[k] === v) next[k] = IGNORE_FIELD;
                                }
                              }
                              next[header] = v;
                              return next;
                            })
                          }
                        >
                          <SelectTrigger className="w-[220px] shrink-0">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={IGNORE_FIELD}>Don't import</SelectItem>
                            {IMPORT_FIELDS.map((f) => (
                              <SelectItem key={f.key} value={f.key}>
                                {f.label}
                                {usedFields.has(f.key) && mapping[header] !== f.key ? " (in use)" : ""}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>

              {!hasNameMapping && (
                <div className="flex items-start gap-2 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4 mt-0.5" />
                  Map a first/last name (or full name) column to continue.
                </div>
              )}
            </div>
          )}

          {/* STEP 3 — PREVIEW */}
          {step === "preview" && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border p-4">
                  <p className="text-2xl font-semibold">{rows.length.toLocaleString()}</p>
                  <p className="text-sm text-muted-foreground">people ready to import</p>
                </div>
                <div className="rounded-lg border p-4">
                  <p className="text-2xl font-semibold">{problems.length.toLocaleString()}</p>
                  <p className="text-sm text-muted-foreground">rows we'll skip</p>
                  {problems.length > 0 && (
                    <Button variant="link" className="px-0 h-auto text-xs" onClick={downloadSkipped}>
                      <Download className="h-3 w-3 mr-1" />
                      Download skipped rows
                    </Button>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                <Label>Add everyone to a flow</Label>
                {lockedFlow ? (
                  <p className="text-sm text-muted-foreground">
                    Everyone will be added to <strong className="text-foreground">{lockedFlow.name}</strong>.
                  </p>
                ) : (
                  <Select value={pipelineId} onValueChange={setPipelineId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a flow" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Don't add to a flow</SelectItem>
                      {flows.map((f) => (
                        <SelectItem key={f.id} value={f.id}>
                          {f.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {activeFlow && (
                  <Select value={stageId} onValueChange={setStageId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a step" />
                    </SelectTrigger>
                    <SelectContent>
                      {activeFlow.stages.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              <div className="flex items-start justify-between gap-4 rounded-lg border p-4">
                <div className="space-y-1">
                  <Label htmlFor="import-tag-toggle">Tag everyone from this file</Label>
                  <p className="text-xs text-muted-foreground">
                    Makes it easy to find or filter this group later.
                  </p>
                </div>
                <Switch id="import-tag-toggle" checked={addTag} onCheckedChange={setAddTag} />
              </div>
              {addTag && (
                <Input
                  value={importTag}
                  onChange={(e) => setImportTag(e.target.value)}
                  placeholder="e.g. easter-guests-2026"
                  maxLength={60}
                />
              )}

              <ScrollArea className="h-[200px] rounded-lg border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 sticky top-0">
                    <tr>
                      <th className="text-left p-2 font-medium">Name</th>
                      <th className="text-left p-2 font-medium">Email</th>
                      <th className="text-left p-2 font-medium">Phone</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 50).map((r) => (
                      <tr key={r.rowNumber} className="border-t">
                        <td className="p-2">{r.name}</td>
                        <td className="p-2 text-muted-foreground">{r.email ?? "—"}</td>
                        <td className="p-2 text-muted-foreground">{r.phone ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ScrollArea>

              {running && (
                <div className="space-y-2">
                  <Progress value={progress} />
                  <p className="text-xs text-muted-foreground text-center">
                    Importing… {progress}%
                  </p>
                </div>
              )}
            </div>
          )}

          {/* STEP 4 — RESULT */}
          {step === "result" && result && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 rounded-lg border bg-muted/40 p-4">
                <CheckCircle2 className="h-6 w-6 text-primary" />
                <div>
                  <p className="font-medium">Import complete</p>
                  <p className="text-sm text-muted-foreground">{fileName}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: "New people", value: result.created, icon: Users },
                  { label: "Updated", value: result.updated, icon: Users },
                  { label: "Added to flow", value: result.enrolled, icon: Users },
                  { label: "Skipped", value: result.skipped, icon: AlertCircle },
                ].map((s) => (
                  <div key={s.label} className="rounded-lg border p-3">
                    <p className="text-xl font-semibold">{s.value.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">{s.label}</p>
                  </div>
                ))}
              </div>
              {result.created > 0 && (
                <p className="text-xs text-muted-foreground">
                  Made a mistake? Undo removes the {result.created.toLocaleString()} newly created{" "}
                  {result.created === 1 ? "person" : "people"} and this import's flow enrollments.
                </p>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <div>
            {step === "map" && (
              <Button variant="ghost" onClick={() => setStep("upload")} disabled={running}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
            )}
            {step === "preview" && (
              <Button variant="ghost" onClick={() => setStep("map")} disabled={running}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to mapping
              </Button>
            )}
            {step === "result" && result && result.created > 0 && (
              <Button variant="ghost" onClick={undoImport} disabled={undoing}>
                {undoing ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Undo2 className="h-4 w-4 mr-2" />
                )}
                Undo import
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            {step === "map" && (
              <Button onClick={() => setStep("preview")} disabled={!hasNameMapping || !records.length}>
                Continue
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            )}
            {step === "preview" && (
              <Button onClick={runImport} disabled={running || !rows.length}>
                {running && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Import {rows.length.toLocaleString()} {rows.length === 1 ? "person" : "people"}
              </Button>
            )}
            {step === "result" && <Button onClick={() => onOpenChange(false)}>Done</Button>}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
