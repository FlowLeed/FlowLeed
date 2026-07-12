import React, { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Header } from "@/components/layout/Header";
import { useToast } from "@/hooks/use-toast";
import { useProfile } from "@/hooks/useProfile";
import { ArrowLeft, Plus, Trash2, ExternalLink, Copy, GripVertical } from "lucide-react";

type Field = {
  id?: string;
  field_key: string;
  label: string;
  field_type: "text" | "textarea" | "email" | "phone" | "number" | "date" | "select" | "radio" | "checkbox";
  required: boolean;
  placeholder?: string | null;
  options?: string[] | null;
  sort_order: number;
  _new?: boolean;
  _deleted?: boolean;
};

const FIELD_TYPES = [
  { v: "text", l: "Short text" },
  { v: "textarea", l: "Long text" },
  { v: "email", l: "Email" },
  { v: "phone", l: "Phone" },
  { v: "number", l: "Number" },
  { v: "date", l: "Date" },
  { v: "select", l: "Dropdown" },
  { v: "radio", l: "Radio" },
  { v: "checkbox", l: "Checkbox" },
];

export default function FormBuilderPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: form } = useQuery({
    queryKey: ["form", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase.from("forms").select("*").eq("id", id!).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: initialFields } = useQuery({
    queryKey: ["form-fields", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("form_fields")
        .select("*")
        .eq("form_id", id!)
        .order("sort_order");
      if (error) throw error;
      return data as any[];
    },
  });

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isPublished, setIsPublished] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [pipelineId, setPipelineId] = useState<string | null>(null);
  const [stageId, setStageId] = useState<string | null>(null);
  const [fields, setFields] = useState<Field[]>([]);

  useEffect(() => {
    if (form) {
      setName(form.name);
      setDescription(form.description || "");
      setIsPublished(form.is_published);
      setSuccessMessage(form.success_message || "");
      setPipelineId(form.pipeline_id);
      setStageId(form.stage_id);
    }
  }, [form]);

  useEffect(() => {
    if (initialFields) {
      setFields(
        initialFields.map((f) => ({
          id: f.id,
          field_key: f.field_key,
          label: f.label,
          field_type: f.field_type,
          required: f.required,
          placeholder: f.placeholder,
          options: Array.isArray(f.options) ? f.options : null,
          sort_order: f.sort_order,
        })),
      );
    }
  }, [initialFields]);

  const { data: pipelines } = useQuery({
    queryKey: ["pipelines-for-form", form?.organization_id],
    enabled: !!form?.organization_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pipelines")
        .select("id, name")
        .eq("organization_id", form!.organization_id)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: stages } = useQuery({
    queryKey: ["stages-for-form", pipelineId],
    enabled: !!pipelineId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pipeline_stages")
        .select("id, name, stage_order")
        .eq("pipeline_id", pipelineId!)
        .order("stage_order");
      if (error) throw error;
      return data;
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      if (!id) return;
      const { error: fErr } = await supabase
        .from("forms")
        .update({
          name,
          description,
          is_published: isPublished,
          success_message: successMessage,
          pipeline_id: pipelineId,
          stage_id: stageId,
        })
        .eq("id", id);
      if (fErr) throw fErr;

      // Sync fields
      for (const f of fields) {
        if (f._deleted && f.id) {
          await supabase.from("form_fields").delete().eq("id", f.id);
        } else if (f._new) {
          await supabase.from("form_fields").insert({
            form_id: id,
            field_key: f.field_key,
            label: f.label,
            field_type: f.field_type,
            required: f.required,
            placeholder: f.placeholder,
            options: f.options,
            sort_order: f.sort_order,
          });
        } else if (f.id) {
          await supabase
            .from("form_fields")
            .update({
              field_key: f.field_key,
              label: f.label,
              field_type: f.field_type,
              required: f.required,
              placeholder: f.placeholder,
              options: f.options,
              sort_order: f.sort_order,
            })
            .eq("id", f.id);
        }
      }
    },
    onSuccess: () => {
      toast({ title: "Saved" });
      qc.invalidateQueries({ queryKey: ["form", id] });
      qc.invalidateQueries({ queryKey: ["form-fields", id] });
      qc.invalidateQueries({ queryKey: ["forms"] });
    },
    onError: (e: any) => toast({ title: "Save failed", description: e.message, variant: "destructive" }),
  });

  const addField = () => {
    const key = `field_${fields.length + 1}`;
    setFields([
      ...fields,
      {
        field_key: key,
        label: "New field",
        field_type: "text",
        required: false,
        sort_order: fields.length,
        _new: true,
      },
    ]);
  };

  const updateField = (idx: number, patch: Partial<Field>) => {
    setFields(fields.map((f, i) => (i === idx ? { ...f, ...patch } : f)));
  };

  const removeField = (idx: number) => {
    setFields(
      fields
        .map((f, i) => (i === idx ? { ...f, _deleted: true } : f))
        .filter((f) => !(f._deleted && f._new)),
    );
  };

  const visibleFields = fields.filter((f) => !f._deleted);

  const copyLink = () => {
    if (!form) return;
    const url = `${window.location.origin}/f/${form.slug}`;
    navigator.clipboard.writeText(url);
    toast({ title: "Link copied" });
  };

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <Header
        title={name || "Form"}
        rightContent={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={copyLink}>
              <Copy className="h-4 w-4 mr-1" /> Copy link
            </Button>
            {form && (
              <Button variant="outline" size="sm" asChild>
                <a href={`/f/${form.slug}`} target="_blank" rel="noreferrer">
                  <ExternalLink className="h-4 w-4 mr-1" /> Preview
                </a>
              </Button>
            )}
            <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending}>
              Save
            </Button>
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-6 max-w-4xl w-full">
        <Button variant="ghost" size="sm" asChild className="mb-2">
          <Link to="/forms">
            <ArrowLeft className="h-4 w-4 mr-1" /> All forms
          </Link>
        </Button>

        <Card>
          <CardContent className="p-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Form name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="flex items-center gap-3 md:justify-end pt-6">
                <Label className="text-sm">Published</Label>
                <Switch checked={isPublished} onCheckedChange={setIsPublished} />
                {isPublished ? (
                  <Badge className="bg-green-100 text-green-700 hover:bg-green-100">Live</Badge>
                ) : (
                  <Badge variant="secondary">Draft</Badge>
                )}
              </div>
            </div>
            <div>
              <Label>Description</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
            </div>
            <div>
              <Label>Success message</Label>
              <Input value={successMessage} onChange={(e) => setSuccessMessage(e.target.value)} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="font-medium">Route submissions into a Flow</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label>Flow</Label>
                <Select
                  value={pipelineId ?? "none"}
                  onValueChange={(v) => {
                    setPipelineId(v === "none" ? null : v);
                    setStageId(null);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select flow" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {(pipelines || []).map((p: any) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Stage</Label>
                <Select
                  value={stageId ?? ""}
                  onValueChange={(v) => setStageId(v || null)}
                  disabled={!pipelineId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select stage" />
                  </SelectTrigger>
                  <SelectContent>
                    {(stages || []).map((s: any) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="font-medium">Fields</div>
              <Button size="sm" variant="outline" onClick={addField}>
                <Plus className="h-4 w-4 mr-1" /> Add field
              </Button>
            </div>
            <div className="space-y-2">
              {visibleFields.map((f, idx) => {
                const realIdx = fields.indexOf(f);
                return (
                  <div key={f.id ?? idx} className="border rounded-md p-3 space-y-2 bg-card">
                    <div className="flex items-center gap-2">
                      <GripVertical className="h-4 w-4 text-muted-foreground" />
                      <Input
                        className="flex-1"
                        value={f.label}
                        onChange={(e) => updateField(realIdx, { label: e.target.value })}
                      />
                      <Select
                        value={f.field_type}
                        onValueChange={(v: any) => updateField(realIdx, { field_type: v })}
                      >
                        <SelectTrigger className="w-40">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {FIELD_TYPES.map((t) => (
                            <SelectItem key={t.v} value={t.v}>{t.l}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <label className="flex items-center gap-2 text-xs text-muted-foreground">
                        Required
                        <Switch
                          checked={f.required}
                          onCheckedChange={(v) => updateField(realIdx, { required: v })}
                        />
                      </label>
                      <Button variant="ghost" size="sm" onClick={() => removeField(realIdx)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        placeholder="Field key (used in data)"
                        value={f.field_key}
                        onChange={(e) => updateField(realIdx, { field_key: e.target.value })}
                      />
                      <Input
                        placeholder="Placeholder"
                        value={f.placeholder || ""}
                        onChange={(e) => updateField(realIdx, { placeholder: e.target.value })}
                      />
                    </div>
                    {["select", "radio", "checkbox"].includes(f.field_type) && (
                      <Input
                        placeholder="Options (comma separated)"
                        value={(f.options || []).join(", ")}
                        onChange={(e) =>
                          updateField(realIdx, {
                            options: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
                          })
                        }
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
