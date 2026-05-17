import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Pencil, Settings2, Loader2, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useContactPcoFieldData } from "@/hooks/useContactPcoFieldData";
import { useUserPcoFieldPreferences } from "@/hooks/useUserPcoFieldPreferences";
import { PcoFieldsPreferenceDialog } from "./PcoFieldsPreferenceDialog";

interface Props {
  contactId: string;
}

export function PcoCustomFieldsCard({ contactId }: Props) {
  const [editOpen, setEditOpen] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const { preferences, isLoading: prefsLoading, save } = useUserPcoFieldPreferences();
  const { data, isLoading: dataLoading } = useContactPcoFieldData(contactId, !prefsLoading);

  const fields = data?.fields ?? [];
  const tabs = data?.tabs ?? [];
  const values = data?.values ?? {};

  const fieldMap = useMemo(() => {
    const m = new Map<string, typeof fields[number]>();
    fields.forEach(f => m.set(f.id, f));
    return m;
  }, [fields]);

  const orderedSelected = useMemo(() => {
    return preferences.selected_field_ids
      .map(id => fieldMap.get(id))
      .filter((f): f is NonNullable<typeof f> => !!f);
  }, [preferences.selected_field_ids, fieldMap]);

  const visible = useMemo(() => {
    if (!preferences.hide_empty) return orderedSelected;
    return orderedSelected.filter(f => {
      const v = values[f.id];
      return v != null && String(v).trim() !== "";
    });
  }, [orderedSelected, values, preferences.hide_empty]);

  const hasSelection = preferences.selected_field_ids.length > 0;
  const loading = prefsLoading || dataLoading;

  return (
    <>
      <Card>
        
        <CardHeader
          className="pb-3 cursor-pointer"
          onClick={() => setIsOpen(o => !o)}
        >
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-base">Pastoral Context</CardTitle>
            <div className="flex items-center gap-1 shrink-0">
              {hasSelection && isOpen && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 gap-1"
                  onClick={(e) => { e.stopPropagation(); setEditOpen(true); }}
                  disabled={loading}
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Edit
                </Button>
              )}
              <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform duration-200", isOpen && "rotate-180")} />
            </div>
          </div>
        </CardHeader>
        {isOpen && (
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading…
            </div>
          ) : !hasSelection ? (
            <div className="flex flex-col items-start gap-3 py-2">
              <p className="text-sm text-muted-foreground">
                Pick the Planning Center fields you want to see for every contact.
              </p>
              <Button size="sm" onClick={() => setEditOpen(true)} disabled={fields.length === 0}>
                <Settings2 className="h-4 w-4 mr-1.5" />
                Configure fields
              </Button>
              {fields.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  No Planning Center fields available for this organization.
                </p>
              )}
            </div>
          ) : visible.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">
              No values for your selected fields.
            </p>
          ) : (
            <dl className="divide-y">
              {visible.map(f => {
                const raw = values[f.id];
                const display = raw != null && String(raw).trim() !== "" ? String(raw) : "—";
                return (
                  <div
                    key={f.id}
                    className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] gap-3 py-2 text-sm"
                  >
                    <dt className="text-muted-foreground">
                      <div className="truncate">{f.name}</div>
                      <div className="truncate text-xs opacity-70">{f.tabName}</div>
                    </dt>
                    <dd className="font-medium break-words whitespace-pre-wrap">{display}</dd>
                  </div>
                );
              })}
            </dl>
          )}
        </CardContent>
        )}
      </Card>

      <PcoFieldsPreferenceDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        tabs={tabs}
        fields={fields}
        initialSelected={preferences.selected_field_ids}
        initialHideEmpty={preferences.hide_empty}
        saving={save.isPending}
        onSave={async (prefs) => {
          await save.mutateAsync(prefs);
          setEditOpen(false);
        }}
      />
    </>
  );
}
