import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MoreVertical } from "lucide-react";
import { Droppable, Draggable } from "react-beautiful-dnd";
import { AdminColumnSettingsDialog } from "./AdminColumnSettingsDialog";

interface AdminFlowStageProps {
  stage: {
    id: string;
    name: string;
    color: string;
    items: any[];
  };
  onUpdateStage?: (id: string, name: string, color: string) => void;
  onAddItem?: (stageId: string) => void;
  renderCard: (item: any, index: number) => React.ReactNode;
}

const getStageColor = (color: string): string => {
  const colorMap: Record<string, string> = {
    blue: "border-blue-400",
    orange: "border-orange-400",
    yellow: "border-yellow-400",
    green: "border-green-400",
    red: "border-red-400",
    purple: "border-purple-400",
    pink: "border-pink-400",
  };
  return colorMap[color] || "border-border";
};

const getColorDot = (color: string): string => {
  const colorMap: Record<string, string> = {
    blue: "bg-blue-400",
    orange: "bg-orange-400",
    yellow: "bg-yellow-400",
    green: "bg-green-400",
    red: "bg-red-400",
    purple: "bg-purple-400",
    pink: "bg-pink-400",
  };
  return colorMap[color] || "bg-muted";
};

export const AdminFlowStage = ({
  stage,
  onUpdateStage,
  onAddItem,
  renderCard,
}: AdminFlowStageProps) => {
  const [settingsOpen, setSettingsOpen] = useState(false);

  const handleSaveSettings = (name: string, color: string) => {
    onUpdateStage?.(stage.id, name, color);
  };

  return (
    <>
      <Card className={`w-72 flex-shrink-0 bg-transparent border-l-4 ${getStageColor(stage.color)} shadow-sm`}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSettingsOpen(true)}
                className={`h-3 w-3 rounded-full ${getColorDot(stage.color)} cursor-pointer hover:ring-2 hover:ring-offset-2 hover:ring-${stage.color}-400 transition-all`}
                aria-label="Edit stage color"
              />
              <h3 className="font-semibold text-sm">{stage.name}</h3>
              <Badge variant="secondary" className="text-xs px-1.5 py-0">
                {stage.items.length}
              </Badge>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={() => setSettingsOpen(true)}
              aria-label="Stage settings"
            >
              <MoreVertical className="h-4 w-4 text-gray-600" />
            </Button>
          </div>
        </CardHeader>
        <Droppable droppableId={stage.id}>
          {(provided, snapshot) => (
            <CardContent
              ref={provided.innerRef}
              {...provided.droppableProps}
              className={`p-2 space-y-2 min-h-[200px] transition-colors ${
                snapshot.isDraggingOver ? "bg-blue-50" : ""
              }`}
            >
              {stage.items.map((item, index) => (
                <Draggable key={item.id} draggableId={item.id} index={index}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      {...provided.dragHandleProps}
                      className={snapshot.isDragging ? "shadow-lg" : ""}
                    >
                      {renderCard(item, index)}
                    </div>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
            </CardContent>
          )}
        </Droppable>
      </Card>
      
      <AdminColumnSettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        columnName={stage.name}
        columnColor={stage.color}
        onSave={handleSaveSettings}
      />
    </>
  );
};
