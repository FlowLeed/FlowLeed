import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { Calendar as CalendarIcon, Filter } from "lucide-react";
import { DateRange, DateRangePreset, getDateRangeFromPreset } from "@/hooks/useAnalytics";

interface DateRangeFilterProps {
  preset: DateRangePreset;
  customRange?: DateRange;
  onPresetChange: (preset: DateRangePreset) => void;
  onCustomRangeChange: (range: DateRange) => void;
}

export const DateRangeFilter = ({
  preset,
  customRange,
  onPresetChange,
  onCustomRangeChange,
}: DateRangeFilterProps) => {
  const presets = [
    { value: "today", label: "Today" },
    { value: "week", label: "This Week" },
    { value: "month", label: "This Month" },
    { value: "year", label: "This Year" },
    { value: "custom", label: "Custom Range" },
  ] as const;

  const displayRange = preset === "custom" && customRange
    ? customRange
    : getDateRangeFromPreset(preset);

  const currentPresetLabel = presets.find((p) => p.value === preset)?.label || "Select Period";

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Filter className="h-4 w-4" />
          <span>{currentPresetLabel}</span>
          <Badge variant="secondary" className="ml-1">
            {format(displayRange.from, "MMM d")} - {format(displayRange.to, "MMM d, yyyy")}
          </Badge>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <div className="space-y-4">
          <div className="space-y-2">
            <h4 className="font-medium text-sm">Date Range</h4>
            <RadioGroup value={preset} onValueChange={onPresetChange}>
              {presets.map((p) => (
                <div key={p.value} className="flex items-center space-x-2">
                  <RadioGroupItem value={p.value} id={p.value} />
                  <Label htmlFor={p.value} className="cursor-pointer">
                    {p.label}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          {preset === "custom" && (
            <div className="pt-2 border-t">
              <Calendar
                initialFocus
                mode="range"
                defaultMonth={customRange?.from}
                selected={{ from: customRange?.from, to: customRange?.to }}
                onSelect={(range) => {
                  if (range?.from && range?.to) {
                    onCustomRangeChange({ from: range.from, to: range.to });
                  }
                }}
                numberOfMonths={1}
              />
            </div>
          )}

          <div className="pt-2 border-t text-sm text-muted-foreground">
            Selected: {format(displayRange.from, "MMM d, yyyy")} - {format(displayRange.to, "MMM d, yyyy")}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};
