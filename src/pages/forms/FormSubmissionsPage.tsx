import React, { useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/layout/Header";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowDown, ArrowLeft, ArrowUp, Download, Inbox, Search } from "lucide-react";
import { format, subDays } from "date-fns";
import { FormTabs } from "@/components/forms/FormTabs";
import { downloadCsv, sanitizeFilename, toCsv } from "@/lib/csvExport";

type Range = "all" | "7" | "30" | "90";

const show = (v: unknown) => {
  if (v === null || v === undefined || v === "") return "";
  if (Array.isArray(v)) return v.join(", ");
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
};

export default function FormSubmissionsPage() {
  const { id } = useParams();
  const [showPreview, setShowPreview] = useState(false);
  const [range, setRange] = useState<Range>("all");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<string>("__date");
  const [sortAsc, setSortAsc] = useState(false);

  const { data: form } = useQuery({
    queryKey: ["form", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase.from("forms").select("id, name").eq("id", id!).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: fields } = useQuery({
    queryKey: ["form-fields-cols", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("form_fields")
        .select("field_key, label, field_type, sort_order")
        .eq("form_id", id!)
        .order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  const { data: submissions, isLoading } = useQuery({
    queryKey: ["form-submissions", id, showPreview, range],
    enabled: !!id,
    queryFn: async () => {
      let q = supabase
        .from("form_submissions")
        .select("id, data, created_at, contact_id, is_preview, contacts(name)")
        .eq("form_id", id!)
        .order("created_at", { ascending: false })
        .limit(1000);
      if (!showPreview) q = q.eq("is_preview", false);
      if (range !== "all") q = q.gte("created_at", subDays(new Date(), Number(range)).toISOString());
      const { data, error } = await q;
      if (error) throw error;
      return data as any[];
    },
  });

  // Columns: current form fields, plus any keys only found in older submissions
  const columns = useMemo(() => {
    const cols = (fields || [])
      .filter((f: any) => !["heading", "paragraph", "divider"].includes(f.field_type))
      .map((f: any) => ({ key: f.field_key as string, label: f.label as string }));
    const known = new Set(cols.map((c) => c.key));
    for (const s of submissions || []) {
      for (const k of Object.keys(s.data || {})) {
        if (!known.has(k)) {
          known.add(k);
          cols.push({ key: k, label: k });
        }
      }
    }
    return cols;
  }, [fields, submissions]);

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    let list = submissions || [];
    if (term) {
      list = list.filter((s) =>
        [s.contacts?.name, ...Object.values(s.data || {}).map(show)].join(" ").toLowerCase().includes(term),
      );
    }
    const val = (s: any) =>
      sortKey === "__date" ? s.created_at : sortKey === "__contact" ? s.contacts?.name || "" : show(s.data?.[sortKey]).toLowerCase();
    return [...list].sort((a, b) => {
      const x = val(a), y = val(b);
      return (x < y ? -1 : x > y ? 1 : 0) * (sortAsc ? 1 : -1);
    });
  }, [submissions, search, sortKey, sortAsc]);

  const toggleSort = (k: string) => {
    if (sortKey === k) setSortAsc(!sortAsc);
    else { setSortKey(k); setSortAsc(true); }
  };

  const SortHead = ({ k, children }: { k: string; children: React.ReactNode }) => (
    <TableHead className="whitespace-nowrap">
      <button type="button" onClick={() => toggleSort(k)} className="inline-flex items-center gap-1 hover:text-foreground">
        {children}
        {sortKey === k && (sortAsc ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
      </button>
    </TableHead>
  );

  const exportCsv = () => {
    const header = ["Submitted", "Contact", ...columns.map((c) => c.label)];
    const body = rows.map((s) => [
      format(new Date(s.created_at), "yyyy-MM-dd HH:mm"),
      s.contacts?.name || "",
      ...columns.map((c) => show(s.data?.[c.key])),
    ]);
    downloadCsv(`${sanitizeFilename(form?.name || "form")}-submissions.csv`, toCsv([header, ...body]));
  };

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <Header title={form?.name || "Submissions"} />
      <div className="border-b px-2 sm:px-6 flex items-center gap-2">
        <Button variant="ghost" size="icon" asChild className="h-9 w-9 shrink-0" aria-label="All forms">
          <Link to="/forms"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        {id && <FormTabs formId={id} active="submissions" count={submissions?.length} />}
      </div>

      <div className="flex flex-wrap items-center gap-2 px-4 sm:px-6 py-3 border-b">
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search answers…" className="pl-8 h-9" />
        </div>
        <Select value={range} onValueChange={(v) => setRange(v as Range)}>
          <SelectTrigger className="h-9 w-[150px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All time</SelectItem>
            <SelectItem value="7">Last 7 days</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
            <SelectItem value="90">Last 90 days</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2">
          <Switch id="show-preview" checked={showPreview} onCheckedChange={setShowPreview} />
          <Label htmlFor="show-preview" className="text-sm cursor-pointer">Include previews</Label>
        </div>
        <Button variant="outline" size="sm" className="sm:ml-auto" onClick={exportCsv} disabled={!rows.length}>
          <Download className="h-4 w-4 mr-1" /> Export CSV
        </Button>
      </div>

      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <p className="p-6 text-muted-foreground">Loading…</p>
        ) : rows.length === 0 ? (
          <div className="m-6 text-center py-16 border-2 border-dashed rounded-lg">
            <Inbox className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="font-medium">No submissions {search || range !== "all" ? "match these filters" : "yet"}</p>
          </div>
        ) : (
          <Table>
            <TableHeader className="sticky top-0 bg-background z-10">
              <TableRow>
                <SortHead k="__date">Submitted</SortHead>
                <SortHead k="__contact">Contact</SortHead>
                {columns.map((c) => <SortHead key={c.key} k={c.key}>{c.label}</SortHead>)}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {format(new Date(s.created_at), "MMM d, yyyy h:mm a")}
                    {s.is_preview && <Badge variant="secondary" className="ml-2">Preview</Badge>}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {s.contact_id ? (
                      <Link to={`/contacts/${s.contact_id}`} className="text-primary hover:underline">
                        {s.contacts?.name || "View contact"}
                      </Link>
                    ) : <span className="text-muted-foreground">Anonymous</span>}
                  </TableCell>
                  {columns.map((c) => (
                    <TableCell key={c.key} className="max-w-[280px] truncate" title={show(s.data?.[c.key])}>
                      {show(s.data?.[c.key])}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
