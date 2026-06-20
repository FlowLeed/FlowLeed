import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Search, X } from "lucide-react";

export type SortKey = "last_contact" | "name" | "recent";

export interface FilterOption {
  value: string;
  label: string;
}

interface Props {
  search: string;
  onSearchChange: (v: string) => void;
  flow: string;
  onFlowChange: (v: string) => void;
  stage: string;
  onStageChange: (v: string) => void;
  campus: string;
  onCampusChange: (v: string) => void;
  sort: SortKey;
  onSortChange: (v: SortKey) => void;
  flowOptions: FilterOption[];
  stageOptions: FilterOption[];
  campusOptions: FilterOption[];
  hasActiveFilters: boolean;
  onClear: () => void;
}

export const MyContactsFilters = ({
  search, onSearchChange,
  flow, onFlowChange,
  stage, onStageChange,
  campus, onCampusChange,
  sort, onSortChange,
  flowOptions, stageOptions, campusOptions,
  hasActiveFilters, onClear,
}: Props) => {
  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search by name..."
          className="pl-9"
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <Select value={flow} onValueChange={onFlowChange}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Flow" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All flows</SelectItem>
            {flowOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={stage} onValueChange={onStageChange}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Stage" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All stages</SelectItem>
            {stageOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={campus} onValueChange={onCampusChange}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Campus" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All campuses</SelectItem>
            {campusOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={sort} onValueChange={(v) => onSortChange(v as SortKey)}>
          <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="last_contact">Last contact (oldest first)</SelectItem>
            <SelectItem value="name">Name (A–Z)</SelectItem>
            <SelectItem value="recent">Recently assigned</SelectItem>
          </SelectContent>
        </Select>
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={onClear} className="gap-1">
            <X className="h-3.5 w-3.5" /> Clear
          </Button>
        )}
      </div>
    </div>
  );
};
