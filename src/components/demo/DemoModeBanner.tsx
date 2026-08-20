import React, { useState } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDemoMode } from "@/hooks/useDemoMode";
import { SetUpChurchDialog } from "./SetUpChurchDialog";

/**
 * Persistent bar shown while sample ("demo") data exists in the organization.
 */
export const DemoModeBanner = () => {
  const { isDemoMode, isLoading } = useDemoMode();
  const [open, setOpen] = useState(false);

  if (isLoading || !isDemoMode) return null;

  return (
    <>
      <div className="w-full border-b bg-primary/10 px-3 py-2 md:px-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="flex items-center gap-2 text-sm text-foreground">
            <Sparkles className="h-4 w-4 shrink-0 text-primary" />
            <span>
              You're exploring <strong>sample data</strong>. Nothing here is real — click around freely.
            </span>
          </p>
          <Button size="sm" onClick={() => setOpen(true)}>
            Set Up My Church
          </Button>
        </div>
      </div>
      <SetUpChurchDialog open={open} onOpenChange={setOpen} />
    </>
  );
};
