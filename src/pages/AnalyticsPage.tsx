import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Header } from "@/components/layout/Header";
import { DateRangeFilter } from "@/components/analytics/DateRangeFilter";
import { OverviewSection } from "@/components/analytics/OverviewSection";
import { FlowsSection } from "@/components/analytics/FlowsSection";
import { TeamSection } from "@/components/analytics/TeamSection";
import { PeopleSection } from "@/components/analytics/PeopleSection";
import { AttendanceSection } from "@/components/analytics/AttendanceSection";
import { DateRange, DateRangePreset, getDateRangeFromPreset } from "@/hooks/useAnalytics";
const AnalyticsPage = () => {
  const [preset, setPreset] = useState<DateRangePreset>("month");
  const [customRange, setCustomRange] = useState<DateRange | undefined>();
  const dateRange = preset === "custom" && customRange ? customRange : getDateRangeFromPreset(preset);
  return <div className="flex flex-col h-full">
      <Header 
        title="Analytics" 
        description="Track performance, analyze trends, and optimize your flows"
        showFlowIcon={false}
        showAddButton={false}
      />

      <div className="flex-1 overflow-auto p-6">
        <div className="mb-6">
          <DateRangeFilter 
            preset={preset} 
            customRange={customRange} 
            onPresetChange={setPreset} 
            onCustomRangeChange={setCustomRange} 
          />
        </div>
        <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="attendance">Attendance</TabsTrigger>
          <TabsTrigger value="flows">Flows</TabsTrigger>
          <TabsTrigger value="team">Team</TabsTrigger>
          <TabsTrigger value="people">People</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <OverviewSection dateRange={dateRange} />
        </TabsContent>
        <TabsContent value="attendance" className="space-y-6">
          <AttendanceSection />
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
      </div>
    </div>;
};
export default AnalyticsPage;