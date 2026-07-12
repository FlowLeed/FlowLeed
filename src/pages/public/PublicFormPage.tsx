import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle2, Loader2 } from "lucide-react";

interface FieldDef {
  id: string;
  field_key: string;
  label: string;
  field_type: string;
  options: string[] | null;
  required: boolean;
  placeholder: string | null;
  help_text: string | null;
}

export default function PublicFormPage() {
  const params = useParams();
  const orgSlug = (params as any).orgSlug as string | undefined;
  const slug = ((params as any).formSlug || (params as any).slug) as string | undefined;
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<any>(null);
  const [org, setOrg] = useState<any>(null);
  const [fields, setFields] = useState<FieldDef[]>([]);
  const [values, setValues] = useState<Record<string, any>>({});
  const [honeypot, setHoneypot] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!slug) return;
    (async () => {
      try {
        const projectId = (import.meta as any).env.VITE_SUPABASE_PROJECT_ID;
        const anon = (import.meta as any).env.VITE_SUPABASE_PUBLISHABLE_KEY;
        const qs = new URLSearchParams({ slug });
        if (orgSlug) qs.set("org_slug", orgSlug);
        const url = `https://${projectId}.supabase.co/functions/v1/public-form-get?${qs.toString()}`;
        const res = await fetch(url, {
          headers: { apikey: anon, Authorization: `Bearer ${anon}` },
        });
        if (!res.ok) {
          setNotFound(true);
          return;
        }
        const payload = await res.json();
        setForm(payload.form);
        setOrg(payload.organization);
        setFields(payload.fields || []);
      } catch (e) {
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    })();
  }, [slug]);


  const setValue = (k: string, v: any) => setValues((prev) => ({ ...prev, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("public-form-submit", {
        body: { slug, data: values, honeypot },
      });
      if (error) throw new Error(error.message);
      if ((data as any)?.error) throw new Error((data as any).error);
      if ((data as any)?.redirect_url) {
        window.location.href = (data as any).redirect_url;
        return;
      }
      setSuccess((data as any)?.message || form?.success_message || "Thanks!");
    } catch (err: any) {
      setError(err.message || "Failed to submit");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (notFound || !form) {
    return (
      <div className="h-screen flex items-center justify-center p-6">
        <div className="text-center">
          <h1 className="text-2xl font-semibold mb-2">Form not found</h1>
          <p className="text-muted-foreground">This form may have been unpublished or the link is invalid.</p>
        </div>
      </div>
    );
  }

  const brandColor = form.brand_color || "#7c3aed";

  return (
    <div className="h-screen overflow-y-auto bg-muted/30">
      <div className="max-w-xl mx-auto p-6 py-10">
        <div className="text-center mb-6">
          {(form.logo_url || org?.logo_url) && (
            <img
              src={form.logo_url || org?.logo_url}
              alt={org?.name || "Logo"}
              className="h-16 mx-auto mb-3 object-contain"
            />
          )}
          {org?.name && <p className="text-sm text-muted-foreground">{org.name}</p>}
        </div>

        <div className="bg-card border rounded-xl shadow-sm p-6 md:p-8">
          {success ? (
            <div className="text-center py-8">
              <CheckCircle2 className="h-14 w-14 mx-auto mb-3" style={{ color: brandColor }} />
              <h2 className="text-xl font-semibold mb-2">Thank you!</h2>
              <p className="text-muted-foreground">{success}</p>
            </div>
          ) : (
            <>
              <h1 className="text-2xl font-bold mb-1">{form.name}</h1>
              {form.description && (
                <p className="text-sm text-muted-foreground mb-6 whitespace-pre-wrap">{form.description}</p>
              )}

              <form onSubmit={submit} className="space-y-4">
                {/* honeypot */}
                <input
                  type="text"
                  tabIndex={-1}
                  autoComplete="off"
                  value={honeypot}
                  onChange={(e) => setHoneypot(e.target.value)}
                  className="hidden"
                  aria-hidden="true"
                />

                {fields.map((f) => (
                  <div key={f.id} className="space-y-1.5">
                    <Label>
                      {f.label}
                      {f.required && <span className="text-destructive"> *</span>}
                    </Label>
                    {renderField(f, values[f.field_key], (v) => setValue(f.field_key, v))}
                    {f.help_text && (
                      <p className="text-xs text-muted-foreground">{f.help_text}</p>
                    )}
                  </div>
                ))}

                {error && (
                  <div className="text-sm text-destructive bg-destructive/10 rounded-md p-2">
                    {error}
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={submitting}
                  className="w-full"
                  style={{ backgroundColor: brandColor }}
                >
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit"}
                </Button>
              </form>
            </>
          )}
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          Powered by Flowleed
        </p>
      </div>
    </div>
  );
}

function renderField(f: FieldDef, value: any, setValue: (v: any) => void) {
  const req = f.required;
  const ph = f.placeholder || "";
  switch (f.field_type) {
    case "textarea":
      return <Textarea value={value || ""} onChange={(e) => setValue(e.target.value)} required={req} placeholder={ph} rows={4} />;
    case "email":
      return <Input type="email" value={value || ""} onChange={(e) => setValue(e.target.value)} required={req} placeholder={ph} />;
    case "phone":
      return <Input type="tel" value={value || ""} onChange={(e) => setValue(e.target.value)} required={req} placeholder={ph} />;
    case "number":
      return <Input type="number" value={value ?? ""} onChange={(e) => setValue(e.target.value)} required={req} placeholder={ph} />;
    case "date":
      return <Input type="date" value={value || ""} onChange={(e) => setValue(e.target.value)} required={req} />;
    case "select":
      return (
        <Select value={value || ""} onValueChange={setValue}>
          <SelectTrigger><SelectValue placeholder={ph || "Select..."} /></SelectTrigger>
          <SelectContent>
            {(f.options || []).map((o) => (
              <SelectItem key={o} value={o}>{o}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    case "radio":
      return (
        <RadioGroup value={value || ""} onValueChange={setValue}>
          {(f.options || []).map((o) => (
            <div key={o} className="flex items-center gap-2">
              <RadioGroupItem value={o} id={`${f.id}-${o}`} />
              <Label htmlFor={`${f.id}-${o}`} className="font-normal">{o}</Label>
            </div>
          ))}
        </RadioGroup>
      );
    case "checkbox": {
      const arr: string[] = Array.isArray(value) ? value : [];
      return (
        <div className="space-y-2">
          {(f.options || []).map((o) => {
            const checked = arr.includes(o);
            return (
              <div key={o} className="flex items-center gap-2">
                <Checkbox
                  id={`${f.id}-${o}`}
                  checked={checked}
                  onCheckedChange={(v) => {
                    setValue(v ? [...arr, o] : arr.filter((x) => x !== o));
                  }}
                />
                <Label htmlFor={`${f.id}-${o}`} className="font-normal">{o}</Label>
              </div>
            );
          })}
        </div>
      );
    }
    default:
      return <Input value={value || ""} onChange={(e) => setValue(e.target.value)} required={req} placeholder={ph} />;
  }
}
