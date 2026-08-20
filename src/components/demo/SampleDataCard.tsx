import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Sparkles } from "lucide-react";
import { useDemoMode } from "@/hooks/useDemoMode";
import { SetUpChurchDialog } from "./SetUpChurchDialog";
import { toast } from "@/hooks/use-toast";

/**
 * Settings card to load or remove the sample church.
 */
export const SampleDataCard = () => {
  const { isDemoMode, realContacts, seedDemoData, isSeeding, isLoading, canOfferDemo } = useDemoMode();
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleLoad = async () => {
    try {
      await seedDemoData();
      toast({ title: "Sample data loaded", description: "Explore flows, people and groups risk-free." });
    } catch (e) {
      toast({
        title: "Couldn't load sample data",
        description: (e as Error).message,
        variant: "destructive",
      });
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-light">
            <Sparkles className="h-4 w-4 text-primary" />
            Sample Data
          </CardTitle>
          <CardDescription>
            A fictional church — people, flows, groups and AI recommendations — so you can explore FlowLeed
            before adding your own people.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isDemoMode ? (
            <Button variant="destructive" onClick={() => setDialogOpen(true)}>
              Remove sample data
            </Button>
          ) : (
            <div className="space-y-2">
              <Button onClick={handleLoad} disabled={isSeeding || isLoading}>
                {isSeeding && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Load sample data
              </Button>
              {realContacts > 0 && (
                <p className="text-xs text-muted-foreground">
                  Heads up: you already have real people. Sample data is removed automatically the next time a
                  real person is added.
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <SetUpChurchDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </>
  );
};
