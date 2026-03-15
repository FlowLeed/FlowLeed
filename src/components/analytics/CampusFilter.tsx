import { Building2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCampuses } from "@/hooks/useCampuses";

interface CampusFilterProps {
  selectedCampusId: string | null;
  onCampusChange: (campusId: string | null) => void;
}

export const CampusFilter = ({ selectedCampusId, onCampusChange }: CampusFilterProps) => {
  const { data: campuses, isLoading } = useCampuses();

  if (isLoading || !campuses || campuses.length === 0) return null;

  return (
    <div className="flex items-center gap-2">
      <Building2 className="h-4 w-4 text-muted-foreground" />
      <Select
        value={selectedCampusId || "all"}
        onValueChange={(value) => onCampusChange(value === "all" ? null : value)}
      >
        <SelectTrigger className="w-[180px] h-9">
          <SelectValue placeholder="All Campuses" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Campuses</SelectItem>
          {campuses.map((campus) => (
            <SelectItem key={campus.id} value={campus.id}>
              {campus.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};
