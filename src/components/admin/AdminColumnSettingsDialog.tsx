import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface AdminColumnSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  columnName: string;
  columnColor: string;
  onSave: (name: string, color: string) => void;
}

const colorOptions = [
  { name: "Blue", value: "blue" },
  { name: "Orange", value: "orange" },
  { name: "Yellow", value: "yellow" },
  { name: "Green", value: "green" },
  { name: "Red", value: "red" },
  { name: "Purple", value: "purple" },
  { name: "Pink", value: "pink" },
];

export const AdminColumnSettingsDialog = ({
  open,
  onOpenChange,
  columnName,
  columnColor,
  onSave,
}: AdminColumnSettingsDialogProps) => {
  const [name, setName] = useState(columnName);
  const [color, setColor] = useState(columnColor);

  const handleSave = () => {
    onSave(name, color);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Column Settings</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="column-name">Column Name</Label>
            <Input
              id="column-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Column Color</Label>
            <div className="grid grid-cols-4 gap-2">
              {colorOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setColor(option.value)}
                  className={`h-10 rounded-md border-2 ${
                    color === option.value
                      ? "border-primary ring-2 ring-primary ring-offset-2"
                      : "border-border"
                  } bg-${option.value}-400`}
                  aria-label={option.name}
                />
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Save Changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
