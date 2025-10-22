import { Header } from "@/components/layout/Header";

const CalendarPage = () => {
  return (
    <div className="flex flex-col h-full">
      <Header 
        title="Calendar" 
        showFlowIcon={false}
        showAddButton={false}
      />
      <div className="flex-1 overflow-auto">
        <div className="p-8 flex items-center justify-center min-h-[60vh]">
          <p className="text-xl text-muted-foreground">More functions are Coming Soon</p>
        </div>
      </div>
    </div>
  );
};

export default CalendarPage;
