import { useState } from "react";
import { Link } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/layout/Header";
import { DateRangeFilter } from "@/components/analytics/DateRangeFilter";
import { CampusFilter } from "@/components/analytics/CampusFilter";
import { OverviewSection } from "@/components/analytics/OverviewSection";
import { FlowsSection } from "@/components/analytics/FlowsSection";
import { TeamSection } from "@/components/analytics/TeamSection";
import { PeopleSection } from "@/components/analytics/PeopleSection";
import { AttendanceSection } from "@/components/analytics/AttendanceSection";
import { HeartbeatCard } from "@/components/analytics/HeartbeatCard";
import { DateRange, DateRangePreset, getDateRangeFromPreset } from "@/hooks/useAnalytics";
import { FileBarChart } from "lucide-react";

const AnalyticsPage = () => {
  const [preset, setPreset] = useState<DateRangePreset>("month");
  const [customRange, setCustomRange] = useState<DateRange | undefined>();
  const [selectedCampusId, setSelectedCampusId] = useState<string | null>(null);
  const dateRange = preset === "custom" && customRange ? customRange : getDateRangeFromPreset(preset);

  return (
    <div className="flex flex-col h-full">
      <Header 
        title="Analytics" 
        description="Track performance, analyze trends, and optimize your flows"
        showFlowIcon={false}
        showAddButton={false}
        rightContent={
          <Button asChild variant="outline" size="sm">
            <Link to="/audit">
              <FileBarChart className="h-4 w-4 mr-2" />
              Church Health Report
            </Link>
          </Button>
        }
      />

      <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-6">
        <div className="mb-6 flex items-center gap-4 flex-wrap">
          <DateRangeFilter 
            preset={preset} 
            customRange={customRange} 
            onPresetChange={setPreset} 
            onCustomRangeChange={setCustomRange} 
          />
          <CampusFilter
            selectedCampusId={selectedCampusId}
            onCampusChange={setSelectedCampusId}
          />
        </div>
        <HeartbeatCard
          campusId={selectedCampusId}
          trendDays={Math.max(2, Math.round((dateRange.to.getTime() - dateRange.from.getTime()) / 86400000))}
        />
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="attendance">Attendance</TabsTrigger>
            <TabsTrigger value="flows">Flows</TabsTrigger>
            <TabsTrigger value="team">Team</TabsTrigger>
            <TabsTrigger value="people">People</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <OverviewSection dateRange={dateRange} campusId={selectedCampusId} />
          </TabsContent>
          <TabsContent value="attendance" className="space-y-6">
            <AttendanceSection campusId={selectedCampusId} />
          </TabsContent>

          <TabsContent value="flows" className="space-y-6">
            <FlowsSection />
          </TabsContent>

          <TabsContent value="team" className="space-y-6">
            <TeamSection dateRange={dateRange} />
          </TabsContent>

          <TabsContent value="people" className="space-y-6">
            <PeopleSection campusId={selectedCampusId} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};
export default AnalyticsPage;