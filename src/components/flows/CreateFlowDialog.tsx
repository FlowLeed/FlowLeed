import React, { useState } from "react";
import { DragDropContext, Droppable, Draggable, DropResult } from 'react-beautiful-dnd';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  GripVertical,
  Plus,
  X,
  Users,
  MessageSquare,
  Calendar,
  Settings,
  Heart,
  Star,
  Target,
  Zap,
  Shield,
  Globe,
  Briefcase,
  BookOpen,
  Music,
  Coffee,
  Camera,
  Gift,
  Flame,
  Sparkles,
  Check,
  Puzzle,
  LayoutDashboard,
  BarChart3,
  Flag,
  FlagTriangleRight
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useFlowContext } from "@/contexts/FlowContext";
import type { LucideIcon } from "lucide-react";
import { AIDescriptionSuggestions } from "./AIDescriptionSuggestions";

interface FlowStep {
  name: string;
  color: string;
  isStartStep?: boolean;
  isEndStep?: boolean;
}

interface CreateFlowDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const iconMap: { [key: string]: LucideIcon } = {
  'Users': Users,
  'MessageSquare': MessageSquare,
  'Calendar': Calendar,
  'Settings': Settings,
  'Heart': Heart,
  'Star': Star,
  'Target': Target,
  'Zap': Zap,
  'Shield': Shield,
  'Globe': Globe,
  'Briefcase': Briefcase,
  'BookOpen': BookOpen,
  'Music': Music,
  'Coffee': Coffee,
  'Camera': Camera,
  'Gift': Gift,
  'Flame': Flame,
  'Sparkles': Sparkles,
  'Check': Check,
  'Plus': Plus,
  'Puzzle': Puzzle,
  'LayoutDashboard': LayoutDashboard,
  'BarChart3': BarChart3
};

export const CreateFlowDialog: React.FC<CreateFlowDialogProps> = ({
  open,
  onOpenChange,
}) => {
  const { toast } = useToast();
  const { createFlow } = useFlowContext();
  const [newFlowName, setNewFlowName] = useState("");
  const [newFlowDescription, setNewFlowDescription] = useState("");
  const [newFlowIcon, setNewFlowIcon] = useState<LucideIcon>(Users);
  const [newFlowSteps, setNewFlowSteps] = useState<FlowStep[]>([
    { name: "New", color: "#3b82f6", isStartStep: true, isEndStep: false },
    { name: "In Progress", color: "#f59e0b", isStartStep: false, isEndStep: false },
    { name: "Completed", color: "#10b981", isStartStep: false, isEndStep: true }
  ]);

  const iconOptions = [
    Users, MessageSquare, Calendar, Settings, Heart, Star, Target, Zap,
    Shield, Globe, Briefcase, BookOpen, Music, Coffee, Camera, Gift,
    Flame, Sparkles, Check, Plus, Puzzle, LayoutDashboard, BarChart3
  ];

  const colorOptions = [
    "#3b82f6", "#f59e0b", "#10b981", "#6366f1", 
    "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4"
  ];

  const handleCreateCustomFlow = async () => {
    if (!newFlowName.trim()) {
      toast({
        title: "Error",
        description: "Please enter a flow name",
        variant: "destructive",
      });
      return;
    }

    try {
      const newPipeline = {
        name: newFlowName,
        icon: Object.keys(iconMap).find(key => iconMap[key] === newFlowIcon) || 'Users',
        stages: newFlowSteps.map((step) => ({
          id: "",
          name: step.name,
          contacts: [],
          color: step.color,
          isStartStep: step.isStartStep || false,
          isEndStep: step.isEndStep || false
        }))
      };

      await createFlow(newPipeline);
      
      toast({
        title: "Flow Created",
        description: `New flow "${newFlowName}" created successfully`,
      });

      // Reset form
      setNewFlowName("");
      setNewFlowDescription("");
      setNewFlowIcon(Users);
      setNewFlowSteps([
        { name: "New", color: "#3b82f6", isStartStep: true, isEndStep: false },
        { name: "In Progress", color: "#f59e0b", isStartStep: false, isEndStep: false },
        { name: "Completed", color: "#10b981", isStartStep: false, isEndStep: true }
      ]);
      onOpenChange(false);
    } catch (error) {
      console.error("Error creating custom flow:", error);
      toast({
        title: "Error",
        description: `Failed to create custom flow: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive",
      });
    }
  };

  const addStep = () => {
    const availableColors = ["#3b82f6", "#f59e0b", "#10b981", "#6366f1", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4"];
    const usedColors = newFlowSteps.map(step => step.color);
    const newColor = availableColors.find(color => !usedColors.includes(color)) || "#64748b";
    setNewFlowSteps([...newFlowSteps, { name: "", color: newColor, isStartStep: false, isEndStep: false }]);
  };

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const items = Array.from(newFlowSteps);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    setNewFlowSteps(items);
  };

  const markAsStartStep = (index: number) => {
    const updated = newFlowSteps.map((step, i) => ({
      ...step,
      isStartStep: i === index,
      isEndStep: i === index ? false : step.isEndStep
    }));
    setNewFlowSteps(updated);
  };

  const markAsEndStep = (index: number) => {
    const updated = newFlowSteps.map((step, i) => ({
      ...step,
      isEndStep: i === index,
      isStartStep: i === index ? false : step.isStartStep
    }));
    setNewFlowSteps(updated);
  };

  const removeStep = (index: number) => {
    if (newFlowSteps.length > 1) {
      setNewFlowSteps(newFlowSteps.filter((_, i) => i !== index));
    }
  };

  const updateStep = (index: number, field: 'name' | 'color', value: string) => {
    const updatedSteps = [...newFlowSteps];
    updatedSteps[index] = { ...updatedSteps[index], [field]: value };
    setNewFlowSteps(updatedSteps);
  };


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Flow</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6 mt-4">
          <div className="space-y-2">
            <Label htmlFor="flow-name">Flow Name</Label>
            <div className="flex items-center space-x-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="icon" className="shrink-0">
                    {React.createElement(newFlowIcon, { className: "h-4 w-4" })}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-64 p-3">
                  <div className="grid grid-cols-6 gap-2">
                    {iconOptions.map((IconComponent, iconIndex) => (
                      <button
                        key={iconIndex}
                        type="button"
                        onClick={() => setNewFlowIcon(IconComponent)}
                        className={`w-8 h-8 rounded-md border hover:bg-gray-100 flex items-center justify-center transition-colors ${
                          newFlowIcon === IconComponent ? 'bg-blue-100 border-blue-300' : 'border-gray-200'
                        }`}
                      >
                        <IconComponent className="h-4 w-4" />
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
              <Input
                id="flow-name"
                value={newFlowName}
                onChange={(e) => setNewFlowName(e.target.value)}
                placeholder="Enter flow name"
                className="flex-1"
              />
            </div>
          </div>
          
              <div className="space-y-2">
                <Label htmlFor="flow-description">Description</Label>
                <Textarea
                  id="flow-description"
                  value={newFlowDescription}
                  onChange={(e) => setNewFlowDescription(e.target.value)}
                  placeholder="Enter flow description (optional)"
                  className="min-h-[80px]"
                />
                <AIDescriptionSuggestions
                  flowName={newFlowName}
                  stages={newFlowSteps}
                  currentDescription={newFlowDescription}
                  onSelect={setNewFlowDescription}
                />
              </div>
          
          <div className="space-y-2">
            <Label>Flow Steps</Label>
            <DragDropContext onDragEnd={handleDragEnd}>
              <Droppable droppableId="flow-steps">
                {(provided) => (
                  <div
                    {...provided.droppableProps}
                    ref={provided.innerRef}
                    className="space-y-3"
                  >
                    {newFlowSteps.map((step, index) => (
                      <Draggable key={index} draggableId={`step-${index}`} index={index}>
                        {(provided) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            className="flex items-center gap-3 bg-background border rounded-lg p-3"
                          >
                            <div {...provided.dragHandleProps} className="cursor-grab active:cursor-grabbing">
                              <GripVertical className="h-5 w-5 text-muted-foreground" />
                            </div>
                            
                            <div className="flex items-center gap-2">
                              <Popover>
                                <PopoverTrigger asChild>
                                  <button
                                    type="button"
                                    className="w-8 h-8 rounded-full border-2 border-gray-200 hover:border-gray-400 transition-colors"
                                    style={{ backgroundColor: step.color }}
                                  />
                                </PopoverTrigger>
                                <PopoverContent className="w-48 p-3">
                                  <div className="grid grid-cols-4 gap-2">
                                    {colorOptions.map((color) => (
                                      <button
                                        key={color}
                                        type="button"
                                        onClick={() => updateStep(index, 'color', color)}
                                        className={`w-8 h-8 rounded-full border-2 hover:scale-105 transition-transform ${
                                          step.color === color ? 'border-gray-400' : 'border-gray-200'
                                        }`}
                                        style={{ backgroundColor: color }}
                                      />
                                    ))}
                                  </div>
                                </PopoverContent>
                              </Popover>
                            </div>
                            
                            <Input
                              value={step.name}
                              onChange={(e) => updateStep(index, 'name', e.target.value)}
                              placeholder="Step name"
                              className="flex-1"
                            />
                            
                            <div className="flex items-center gap-1">
                              <Button
                                variant={step.isStartStep ? "default" : "ghost"}
                                size="sm"
                                onClick={() => markAsStartStep(index)}
                                title="Mark as start step"
                              >
                                <Flag className="h-4 w-4" />
                              </Button>
                              <Button
                                variant={step.isEndStep ? "default" : "ghost"}
                                size="sm"
                                onClick={() => markAsEndStep(index)}
                                title="Mark as end step"
                              >
                                <FlagTriangleRight className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => removeStep(index)}
                                disabled={newFlowSteps.length === 1}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </DragDropContext>
            <Button
              variant="outline"
              size="sm"
              onClick={addStep}
              className="w-full mt-3"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Step
            </Button>
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleCreateCustomFlow}>
            Create Flow
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
