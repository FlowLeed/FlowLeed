import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DateRangeFilter } from "@/components/analytics/DateRangeFilter";
import { OverviewSection } from "@/components/analytics/OverviewSection";
import { FlowsSection } from "@/components/analytics/FlowsSection";
import { TeamSection } from "@/components/analytics/TeamSection";
import { PeopleSection } from "@/components/analytics/PeopleSection";
import { DateRange, DateRangePreset, getDateRangeFromPreset } from "@/hooks/useAnalytics";
const AnalyticsPage = () => {
  const [preset, setPreset] = useState<DateRangePreset>("month");
  const [customRange, setCustomRange] = useState<DateRange | undefined>();
  const dateRange = preset === "custom" && customRange ? customRange : getDateRangeFromPreset(preset);
  return <div className="container mx-auto py-6 space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl tracking-tight font-extralight">Analytics</h1>
          <p className="text-muted-foreground">
            Track performance, analyze trends, and optimize your flows
          </p>
        </div>
        <DateRangeFilter preset={preset} customRange={customRange} onPresetChange={setPreset} onCustomRangeChange={setCustomRange} />
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="flows">Flows</TabsTrigger>
          <TabsTrigger value="team">Team</TabsTrigger>
          <TabsTrigger value="people">People</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <OverviewSection dateRange={dateRange} />
        </TabsContent>

        <TabsContent value="flows" className="space-y-6">
          <FlowsSection />
        </TabsContent>

        <TabsContent value="team" className="space-y-6">
          <TeamSection dateRange={dateRange} />
        </TabsContent>

        <TabsContent value="people" className="space-y-6">
          <PeopleSection />
        </TabsContent>
      </Tabs>
    </div>;
};
export default AnalyticsPage;