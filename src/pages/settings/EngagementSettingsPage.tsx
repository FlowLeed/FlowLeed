import { useEffect, useMemo, useState } from "react";
import { Activity, LockKeyhole, RefreshCw, RotateCcw } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useIsOrgAdmin } from "@/hooks/useIsOrgAdmin";
import { useEngagementSettings, type EngagementPreview } from "@/hooks/useEngagementSettings";
import { useActiveLifeSeasons } from "@/hooks/useLifeSeason";
import { PauseCircle } from "lucide-react";
import {
  activeWeightTotal,
  DEFAULT_LABELS,
  ENGAGEMENT_INGREDIENTS,
  ENGAGEMENT_PRESETS,
  LEVEL_ORDER,
  presetSettings,
  type EngagementLevelKey,
  type EngagementSettings,
  type EngagementWeights,
} from "@/lib/engagementSettings";

const levelTone: Record<EngagementLevelKey, string> = {
  highly_engaged: "text-emerald-600",
  active: "text-blue-600",
  at_risk: "text-amber-600",
  inactive: "text-red-600",
  new: "text-muted-foreground",
};

export const EngagementSettingsContent = () => {
  const { user } = useAuth();
  const { isOrgAdmin, isLoading: adminLoading } = useIsOrgAdmin(user?.id);
  const { settings, isLoading, save, preview } = useEngagementSettings();

  const [draft, setDraft] = useState<EngagementSettings>(settings);
  const [dirty, setDirty] = useState(false);
  const [previewData, setPreviewData] = useState<EngagementPreview | null>(null);
  const { data: activeSeasons } = useActiveLifeSeasons();
  const pausedSeasons = activeSeasons ?? [];

  useEffect(() => {
    if (!dirty) setDraft(settings);
  }, [settings, dirty]);

  const readOnly = !isOrgAdmin;
  const weightTotal = useMemo(() => activeWeightTotal(draft), [draft]);
  const previewSamplesByLevel = useMemo(() => {
    const grouped = Object.fromEntries(LEVEL_ORDER.map((level) => [level, []])) as Record<
      EngagementLevelKey,
      EngagementPreview["samples"]
    >;
    for (const sample of previewData?.samples ?? []) {
      if (LEVEL_ORDER.includes(sample.engagement_level as EngagementLevelKey)) {
        grouped[sample.engagement_level as EngagementLevelKey].push(sample);
      }
    }
    return grouped;
  }, [previewData]);

  const update = (patch: Partial<EngagementSettings>) => {
    setDraft((prev) => ({ ...prev, ...patch }));
    setDirty(true);
  };

  const setWeight = (key: keyof EngagementWeights, value: number) =>
    update({ weights: { ...draft.weights, [key]: value } });

  const applyPreset = (key: string) => {
    setDraft({ ...presetSettings(key), labels: draft.labels });
    setDirty(true);
    setPreviewData(null);
  };

  const runPreview = async () => {
    try {
      const result = await preview.mutateAsync(draft);
      setPreviewData(result);
    } catch (error) {
      toast.error("Could not preview these settings", { description: (error as Error).message });
    }
  };

  const handleSave = async (recalculate: boolean) => {
    try {
      await save.mutateAsync({ settings: draft, recalculate });
      setDirty(false);
      toast.success(recalculate ? "Saved and scores updated" : "Engagement settings saved");
    } catch (error) {
      toast.error("Could not save engagement settings", { description: (error as Error).message });
    }
  };

  return (
    <div className="w-full space-y-6">
      <section className="flex flex-col gap-4 border-b pb-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Activity className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold">Engagement scoring</h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Decide what counts as engagement at your church, how much each part matters, and what you call each level.
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 px-3 text-xs"
            onClick={runPreview}
            disabled={preview.isPending || isLoading}
          >
            {preview.isPending ? <RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
            Preview
          </Button>
          <Button
            size="sm"
            className="h-8 px-3 text-xs"
            onClick={() => handleSave(true)}
            disabled={readOnly || !dirty || save.isPending}
          >
            {save.isPending ? <RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
            Save &amp; update
          </Button>
        </div>

      </section>

      {pausedSeasons.length > 0 && (
        <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <PauseCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            {pausedSeasons.length} {pausedSeasons.length === 1 ? "person is" : "people are"} in a life season right now
            (sick, new baby, deployed and similar). Their scores stay frozen and they're left out of attention lists until
            the season ends.
          </p>
        </div>
      )}



      {readOnly && !adminLoading && (
        <div className="flex items-start gap-3 rounded-md border bg-muted/40 p-4 text-sm">
          <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0" />
          <p>You can see how scoring works. An organization owner or admin can change it.</p>
        </div>
      )}

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold">Starting point</h2>
          <p className="text-sm text-muted-foreground">Pick the approach closest to your church, then fine-tune below.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {ENGAGEMENT_PRESETS.map((preset) => {
            const selected = draft.preset_key === preset.key;
            return (
              <button
                key={preset.key}
                type="button"
                disabled={readOnly}
                onClick={() => applyPreset(preset.key)}
                className={`rounded-md border p-4 text-left transition-colors ${
                  selected ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                } disabled:cursor-not-allowed disabled:opacity-70`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{preset.label}</span>
                  {selected && <Badge variant="secondary">Selected</Badge>}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{preset.description}</p>
              </button>
            );
          })}
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold">What counts</h2>
          <p className="text-sm text-muted-foreground">Turn on the signs of engagement your church actually tracks.</p>
        </div>
        <div className="grid gap-3">
          {ENGAGEMENT_INGREDIENTS.map((ingredient) => {
            const enabled = draft.ingredients[ingredient.key];
            const blocked = !!ingredient.requiresIntegration;
            const weight = ingredient.weightKey ? draft.weights[ingredient.weightKey] : null;
            return (
              <Card key={ingredient.key} className="rounded-md">
                <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0 pb-3">
                  <div className="space-y-1">
                    <CardTitle className="text-base">{ingredient.label}</CardTitle>
                    <CardDescription>
                      {ingredient.requiresIntegration ?? ingredient.description}
                    </CardDescription>
                  </div>
                  <Switch
                    checked={enabled && !blocked}
                    disabled={readOnly || blocked}
                    onCheckedChange={(value) =>
                      update({ ingredients: { ...draft.ingredients, [ingredient.key]: value } })
                    }
                    aria-label={`${enabled ? "Turn off" : "Turn on"} ${ingredient.label}`}
                  />
                </CardHeader>
                {enabled && !blocked && ingredient.weightKey && weight !== null && (
                  <CardContent className="space-y-2 pt-0">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">How much it matters</span>
                      <span className="font-medium">{weight} points</span>
                    </div>
                    <Slider
                      value={[weight]}
                      min={0}
                      max={60}
                      step={1}
                      disabled={readOnly}
                      onValueChange={([value]) => {
                        if (ingredient.weightKey) setWeight(ingredient.weightKey, value);
                      }}
                    />
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
        <p className="text-sm text-muted-foreground">
          Points in use: <span className="font-medium text-foreground">{weightTotal}</span>. Scores are always shown out of 100,
          so the split between parts is what matters, not the total.
        </p>
      </section>

      <Accordion type="multiple" className="rounded-md border px-4">
        <AccordionItem value="attendance">
          <AccordionTrigger className="text-base font-semibold">Attendance details</AccordionTrigger>
          <AccordionContent className="space-y-4 pb-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <NumberField
                label="Weeks we look back"
                value={draft.windows.consistency_weeks}
                min={4}
                max={52}
                disabled={readOnly}
                onChange={(value) => update({ windows: { ...draft.windows, consistency_weeks: value } })}
              />
              <NumberField
                label="Days until a person counts as gone"
                value={draft.windows.recency_days}
                min={14}
                max={365}
                disabled={readOnly}
                onChange={(value) => update({ windows: { ...draft.windows, recency_days: value } })}
              />
              <NumberField
                label="Serving window (days)"
                value={draft.windows.serving_days}
                min={14}
                max={365}
                disabled={readOnly}
                onChange={(value) => update({ windows: { ...draft.windows, serving_days: value } })}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <NumberField
                label="Other activity window (days)"
                value={draft.windows.activity_days}
                min={14}
                max={365}
                disabled={readOnly}
                onChange={(value) => update({ windows: { ...draft.windows, activity_days: value } })}
              />
              <NumberField
                label="Consistency points"
                value={draft.weights.consistency}
                min={0}
                max={60}
                disabled={readOnly}
                onChange={(value) => setWeight("consistency", value)}
              />
              <NumberField
                label="Recency points"
                value={draft.weights.recency}
                min={0}
                max={60}
                disabled={readOnly}
                onChange={(value) => setWeight("recency", value)}
              />
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="streak">
          <AccordionTrigger className="text-base font-semibold">Streaks</AccordionTrigger>
          <AccordionContent className="space-y-4 pb-4">
            <div className="flex items-start justify-between gap-4 rounded-md border p-4">
              <div>
                <p className="font-medium">Count part-weeks as attended</p>
                <p className="text-sm text-muted-foreground">
                  A streak counts weeks in a row. Misses allowed before a streak breaks is set below.
                </p>
              </div>
              <Switch
                checked={draft.safeguards.count_partial_week}
                disabled={readOnly}
                onCheckedChange={(value) => update({ safeguards: { ...draft.safeguards, count_partial_week: value } })}
                aria-label="Count part weeks as attended"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <NumberField
                label="Missed weeks allowed before a streak breaks"
                value={draft.safeguards.streak_break_misses}
                min={0}
                max={4}
                disabled={readOnly}
                onChange={(value) => update({ safeguards: { ...draft.safeguards, streak_break_misses: value } })}
              />
              <NumberField
                label="Streak points"
                value={draft.weights.streak}
                min={0}
                max={40}
                disabled={readOnly}
                onChange={(value) => setWeight("streak", value)}
              />
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="levels">
          <AccordionTrigger className="text-base font-semibold">Levels and names</AccordionTrigger>
          <AccordionContent className="space-y-4 pb-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <NumberField
                label={`${draft.labels.highly_engaged} starts at`}
                value={draft.thresholds.highly_engaged}
                min={1}
                max={100}
                disabled={readOnly}
                onChange={(value) => update({ thresholds: { ...draft.thresholds, highly_engaged: value } })}
              />
              <NumberField
                label={`${draft.labels.active} starts at`}
                value={draft.thresholds.active}
                min={1}
                max={99}
                disabled={readOnly}
                onChange={(value) => update({ thresholds: { ...draft.thresholds, active: value } })}
              />
              <NumberField
                label={`${draft.labels.at_risk} starts at`}
                value={draft.thresholds.at_risk}
                min={1}
                max={98}
                disabled={readOnly}
                onChange={(value) => update({ thresholds: { ...draft.thresholds, at_risk: value } })}
              />
            </div>
            <NumberField
              label={`Check-ins before someone stops being "${draft.labels.new}"`}
              value={draft.thresholds.new_max_checkins}
              min={1}
              max={20}
              disabled={readOnly}
              onChange={(value) => update({ thresholds: { ...draft.thresholds, new_max_checkins: value } })}
            />
            <div className="grid gap-3 sm:grid-cols-2">
              {LEVEL_ORDER.map((level) => (
                <div key={level} className="space-y-1.5">
                  <Label className="text-sm">What you call {DEFAULT_LABELS[level].toLowerCase()} people</Label>
                  <Input
                    value={draft.labels[level]}
                    disabled={readOnly}
                    maxLength={40}
                    onChange={(event) => update({ labels: { ...draft.labels, [level]: event.target.value } })}
                  />
                </div>
              ))}
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="safeguards" className="border-b-0">
          <AccordionTrigger className="text-base font-semibold">Safeguards</AccordionTrigger>
          <AccordionContent className="space-y-4 pb-4">
            <ToggleRow
              title="Serving or leading keeps someone active"
              description={`People serving or leading never fall below "${draft.labels.active}".`}
              checked={draft.safeguards.serving_keeps_active}
              disabled={readOnly}
              onChange={(value) => update({ safeguards: { ...draft.safeguards, serving_keeps_active: value } })}
            />
            <ToggleRow
              title="Credit household check-ins"
              description="Parents get credit when their children are checked in."
              checked={draft.safeguards.household_credit}
              disabled={readOnly}
              onChange={(value) => update({ safeguards: { ...draft.safeguards, household_credit: value } })}
            />
            <NumberField
              label="Recent attendance protects a person for (days)"
              value={draft.safeguards.recent_attendance_days}
              min={0}
              max={90}
              disabled={readOnly}
              onChange={(value) => update({ safeguards: { ...draft.safeguards, recent_attendance_days: value } })}
            />
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      <Dialog open={!!previewData} onOpenChange={(open) => !open && setPreviewData(null)}>
        <DialogContent className="flex max-h-[calc(100dvh-1rem)] max-w-4xl flex-col gap-0 p-0">
          <DialogHeader className="shrink-0 border-b px-5 py-4 pr-12 sm:px-6">
            <DialogTitle>Engagement preview</DialogTitle>
            {previewData && (
              <DialogDescription>
                {previewData.people_scored.toLocaleString()} people reviewed, with an average score of{" "}
                {Math.round(previewData.average_score)}.
                {previewData.sampled
                  ? " Results are estimated from a sample so the preview stays fast."
                  : " These results include everyone."}
              </DialogDescription>
            )}
          </DialogHeader>

          {previewData && (
            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5 sm:px-6">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                {LEVEL_ORDER.map((level) => (
                  <div key={level} className="rounded-md border p-3">
                    <p className={`text-xs font-medium sm:text-sm ${levelTone[level]}`}>{draft.labels[level]}</p>
                    <p className="mt-1 text-xl font-semibold">
                      {(previewData.distribution?.[level] ?? 0).toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>

              <div>
                <h3 className="font-semibold">A few people from each level</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Use these examples to check how the draft settings score different kinds of engagement.
                </p>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                {LEVEL_ORDER.map((level) => {
                  const levelSamples = previewSamplesByLevel[level];
                  return (
                    <section key={level} className="rounded-md border">
                      <div className="flex items-center justify-between border-b px-4 py-3">
                        <h4 className={`text-sm font-semibold ${levelTone[level]}`}>{draft.labels[level]}</h4>
                        <span className="text-xs text-muted-foreground">
                          {(previewData.distribution?.[level] ?? 0).toLocaleString()} people
                        </span>
                      </div>
                      <div className="divide-y">
                        {levelSamples.length > 0 ? (
                          levelSamples.map((sample) => (
                            <div key={sample.contact_id} className="flex min-h-11 items-center justify-between gap-3 px-4 py-2 text-sm">
                              <span className="truncate">{sample.full_name || "Unnamed"}</span>
                              <Badge variant="outline" className="shrink-0">{sample.score}</Badge>
                            </div>
                          ))
                        ) : (
                          <p className="px-4 py-3 text-sm text-muted-foreground">No one in this level.</p>
                        )}
                      </div>
                    </section>
                  );
                })}
              </div>

              <p className="text-xs text-muted-foreground">Nothing changes until you save and update scores.</p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <div className="flex flex-wrap items-center gap-2 border-t pt-4">
        <Button
          variant="outline"
          className="min-h-11"
          disabled={readOnly || save.isPending}
          onClick={() => {
            setDraft({ ...presetSettings("balanced"), labels: { ...DEFAULT_LABELS } });
            setDirty(true);
            setPreviewData(null);
          }}
        >
          <RotateCcw className="mr-2 h-4 w-4" />
          Reset to FlowLeed defaults
        </Button>
        <Button variant="secondary" className="min-h-11" disabled={readOnly || !dirty || save.isPending} onClick={() => handleSave(false)}>
          Save without recalculating
        </Button>
      </div>
    </div>
  );
};

const NumberField = ({
  label,
  value,
  min,
  max,
  disabled,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  disabled?: boolean;
  onChange: (value: number) => void;
}) => (
  <div className="space-y-1.5">
    <Label className="text-sm">{label}</Label>
    <Input
      type="number"
      inputMode="numeric"
      value={value}
      min={min}
      max={max}
      disabled={disabled}
      onChange={(event) => {
        const next = Number(event.target.value);
        if (Number.isNaN(next)) return;
        onChange(Math.min(max, Math.max(min, next)));
      }}
    />
  </div>
);

const ToggleRow = ({
  title,
  description,
  checked,
  disabled,
  onChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (value: boolean) => void;
}) => (
  <div className="flex items-start justify-between gap-4 rounded-md border p-4">
    <div>
      <p className="font-medium">{title}</p>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
    <Switch checked={checked} disabled={disabled} onCheckedChange={onChange} aria-label={title} />
  </div>
);

const EngagementSettingsPage = () => (
  <div className="min-h-full bg-background">
    <Header title="Engagement scoring" />
    <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
      <EngagementSettingsContent />
    </main>
  </div>
);

export default EngagementSettingsPage;
