import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { MapPin } from "lucide-react";

interface MobilePersonRowProps {
  name: string;
  avatar?: string | null;
  email?: string | null;
  phone?: string | null;
  campus?: string | null;
  selected?: boolean;
  onSelect?: () => void;
  onOpen: () => void;
  status?: React.ReactNode;
  details?: React.ReactNode;
}

const initials = (name: string) =>
  name.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();

export const MobilePersonRow = ({ name, avatar, email, phone, campus, selected, onSelect, onOpen, status, details }: MobilePersonRowProps) => (
  <div className={`flex min-h-16 items-start gap-3 px-3 py-3 transition-colors active:bg-muted/60 ${selected ? "bg-primary/5" : ""}`}>
    {onSelect && (
      <div className="flex h-10 w-10 shrink-0 items-center justify-center" onClick={(event) => event.stopPropagation()}>
        <Checkbox checked={selected} onCheckedChange={onSelect} aria-label={`Select ${name}`} />
      </div>
    )}
    <button type="button" onClick={onOpen} className="flex min-w-0 flex-1 items-start gap-3 text-left">
      <Avatar className="h-10 w-10 shrink-0">
        <AvatarImage src={avatar || undefined} alt={name} />
        <AvatarFallback>{initials(name)}</AvatarFallback>
      </Avatar>
      <span className="min-w-0 flex-1">
        <span className="flex items-start justify-between gap-2">
          <span className="truncate text-sm font-medium text-foreground">{name}</span>
          {status && <span className="shrink-0">{status}</span>}
        </span>
        {(email || phone) && <span className="mt-0.5 block truncate text-xs text-muted-foreground">{email || phone}</span>}
        <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          {campus && <span className="inline-flex min-w-0 items-center gap-1"><MapPin className="h-3 w-3 shrink-0" /><span className="truncate">{campus}</span></span>}
          {details}
        </span>
      </span>
    </button>
  </div>
);