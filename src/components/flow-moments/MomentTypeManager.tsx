import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Trash2, Edit2 } from "lucide-react";
import { useFlowMomentTypes, type FlowMomentType } from "@/hooks/useFlowMomentTypes";
import { iconMap, iconOptions } from "@/lib/flowIcons";

interface MomentTypeManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MomentTypeManager({ open, onOpenChange }: MomentTypeManagerProps) {
  const { momentTypes, createMomentType, updateMomentType, deleteMomentType } = useFlowMomentTypes();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    category: "next_step" as FlowMomentType['category'],
    weight: 20,
    description: "",
    icon: "Sparkles",
    color: "#8b5cf6",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (editingId) {
      await updateMomentType.mutateAsync({ id: editingId, data: formData });
      setEditingId(null);
    } else {
      await createMomentType.mutateAsync(formData);
    }
    
    setFormData({
      name: "",
      category: "next_step",
      weight: 20,
      description: "",
      icon: "Sparkles",
      color: "#8b5cf6",
    });
  };

  const handleEdit = (momentType: FlowMomentType) => {
    setEditingId(momentType.id);
    setFormData({
      name: momentType.name,
      category: momentType.category,
      weight: momentType.weight,
      description: momentType.description || "",
      icon: momentType.icon || "Sparkles",
      color: momentType.color || "#8b5cf6",
    });
  };

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this moment type?")) {
      await deleteMomentType.mutateAsync(id);
    }
  };


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Manage Moment Types</DialogTitle>
          <DialogDescription>
            Create and manage the types of Flow Moments that can be tracked in your organization.
          </DialogDescription>
        </DialogHeader>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Salvation Decision"
                required
              />
            </div>

            <div>
              <Label htmlFor="category">Category *</Label>
              <Select
                value={formData.category}
                onValueChange={(value: any) => setFormData({ ...formData, category: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="salvation">Salvation</SelectItem>
                  <SelectItem value="next_step">Next Step</SelectItem>
                  <SelectItem value="serving">Serving</SelectItem>
                  <SelectItem value="group">Group</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="weight">Weight (1-100)</Label>
              <Input
                id="weight"
                type="number"
                min="1"
                max="100"
                value={formData.weight}
                onChange={(e) => setFormData({ ...formData, weight: parseInt(e.target.value) || 10 })}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Higher weights indicate more important moments
              </p>
            </div>

            <div>
              <Label htmlFor="icon">Icon</Label>
              <Select
                value={formData.icon}
                onValueChange={(value) => setFormData({ ...formData, icon: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select icon" />
                </SelectTrigger>
                <SelectContent>
                  {iconOptions.map((option) => {
                    const Icon = iconMap[option.name];
                    return (
                      <SelectItem key={option.name} value={option.name}>
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4" />
                          <span>{option.name}</span>
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="color">Color</Label>
              <div className="flex gap-2">
                <Input
                  id="color"
                  type="color"
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  className="w-20"
                />
                <Input
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  placeholder="#8b5cf6"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Optional description..."
                rows={3}
              />
            </div>

            <div className="flex gap-2">
              <Button type="submit" className="flex-1">
                {editingId ? "Update" : <><Plus className="h-4 w-4 mr-2" /> Create</>}
              </Button>
              {editingId && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setEditingId(null);
                    setFormData({
                      name: "",
                      category: "next_step",
                      weight: 20,
                      description: "",
                      icon: "Sparkles",
                      color: "#8b5cf6",
                    });
                  }}
                >
                  Cancel
                </Button>
              )}
            </div>
          </form>

          {/* List */}
          <div className="space-y-3">
            <h3 className="font-semibold">Existing Moment Types ({momentTypes.length})</h3>
            <div className="space-y-2 max-h-[500px] overflow-y-auto">
              {momentTypes.map((mt) => {
                const Icon = mt.icon ? iconMap[mt.icon] : iconMap.Sparkles;
                return (
                  <Card key={mt.id} className={editingId === mt.id ? "ring-2 ring-primary" : ""}>
                    <CardContent className="p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2 flex-1">
                          <div
                            className="p-2 rounded-lg shrink-0"
                            style={{ backgroundColor: `${mt.color}20` }}
                          >
                            <Icon className="h-4 w-4" style={{ color: mt.color || undefined }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium">{mt.name}</div>
                            <div className="text-xs text-muted-foreground mt-1">
                              <Badge variant="outline" className="text-xs">
                                {mt.category}
                              </Badge>
                              <span className="mx-2">•</span>
                              Weight: {mt.weight}
                            </div>
                            {mt.description && (
                              <p className="text-xs text-muted-foreground mt-1">{mt.description}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0"
                            onClick={() => handleEdit(mt)}
                          >
                            <Edit2 className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0 text-destructive"
                            onClick={() => handleDelete(mt.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
