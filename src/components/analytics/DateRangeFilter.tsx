import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
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
    { value: "custom", label: "Custom" },
  ] as const;

  const displayRange = preset === "custom" && customRange
    ? customRange
    : getDateRangeFromPreset(preset);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex gap-1 bg-muted p-1 rounded-lg">
        {presets.map((p) => (
          <Button
            key={p.value}
            variant={preset === p.value ? "default" : "ghost"}
            size="sm"
            onClick={() => onPresetChange(p.value)}
          >
            {p.label}
          </Button>
        ))}
      </div>

      {preset === "custom" && (
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "justify-start text-left font-normal",
                !customRange && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {customRange ? (
                <>
                  {format(customRange.from, "LLL dd, y")} -{" "}
                  {format(customRange.to, "LLL dd, y")}
                </>
              ) : (
                <span>Pick a date range</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
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
              numberOfMonths={2}
            />
          </PopoverContent>
        </Popover>
      )}

      <span className="text-sm text-muted-foreground">
        {format(displayRange.from, "MMM d, yyyy")} - {format(displayRange.to, "MMM d, yyyy")}
      </span>
    </div>
  );
};
