import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Printer, LayoutDashboard, HeartPulse, Users2, Layers, ArrowLeft } from 'lucide-react';
import { ScoreGauge } from '@/components/audit/ScoreGauge';
import { SectionCard, type Finding } from '@/components/audit/SectionCard';
import { CohortDialog } from '@/components/audit/CohortDialog';
import flowleedLogo from '@/assets/flowleed_logo_new.png';
import { useProfile } from '@/hooks/useProfile';

interface Report {
  id: string;
  organization_id: string;
  status: string;
  overall_score: number | null;
  section_scores: Record<string, number> | null;
  metrics: Record<string, any> | null;
  generated_at: string | null;
}

const AuditReportPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { organization } = useProfile();
  const [report, setReport] = useState<Report | null>(null);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [loading, setLoading] = useState(true);
  const [openFinding, setOpenFinding] = useState<Finding | null>(null);

  useEffect(() => {
    if (!id) return;
    (async () => {
      setLoading(true);
      const [r, f] = await Promise.all([
        supabase.from('church_health_reports').select('*').eq('id', id).maybeSingle(),
        supabase.from('church_health_findings').select('*').eq('report_id', id).order('section').order('sort_order'),
      ]);
      setReport((r.data as unknown as Report) || null);
      setFindings((f.data as unknown as Finding[]) || []);
      setLoading(false);
    })();
  }, [id]);

  const bySection = useMemo(() => {
    const m: Record<string, Finding[]> = { at_risk: [], volunteers: [], groups: [] };
    for (const f of findings) (m[f.section] ||= []).push(f);
    return m;
  }, [findings]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!report) {
    return (
      <div className="min-h-screen flex items-center justify-center text-center px-4">
        <div>
          <h1 className="text-xl font-semibold mb-2">Report not found</h1>
          <Button onClick={() => navigate('/audit/connect')} variant="outline">Start a new audit</Button>
        </div>
      </div>
    );
  }

  const overall = report.overall_score ?? 0;
  const scores = report.section_scores || {};

  return (
    <div className="h-screen bg-background overflow-y-auto pb-16 print:pb-0">
      <header className="border-b bg-card sticky top-0 z-10 print:hidden">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <img src={flowleedLogo} alt="Flowleed" className="h-6" />
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
              <LayoutDashboard className="h-4 w-4 mr-1.5" /> Dashboard
            </Button>
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              <Printer className="h-4 w-4 mr-1.5" /> Export PDF
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
        <div className="text-center space-y-2">
          <div className="text-sm text-muted-foreground">Church Health Report</div>
          <h1 className="text-3xl md:text-4xl font-bold">{organization?.name || 'Your Church'}</h1>
          {report.generated_at && (
            <div className="text-xs text-muted-foreground">
              Generated {new Date(report.generated_at).toLocaleString()}
            </div>
          )}
        </div>

        {/* Overall gauge */}
        <Card>
          <CardContent className="py-8">
            <div className="grid md:grid-cols-4 gap-6 items-center">
              <div className="flex justify-center md:col-span-1">
                <ScoreGauge score={overall} label="Overall" />
              </div>
              <div className="md:col-span-3 grid grid-cols-3 gap-4 text-center">
                <ScoreGauge score={scores.at_risk ?? 0} size={120} label="At-Risk People" />
                <ScoreGauge score={scores.volunteers ?? 0} size={120} label="Volunteers & Leaders" />
                <ScoreGauge score={scores.groups ?? 0} size={120} label="Groups" />
              </div>
            </div>
          </CardContent>
        </Card>

        <SectionCard
          icon={HeartPulse}
          title="At-Risk People"
          score={scores.at_risk ?? 0}
          findings={bySection.at_risk || []}
          onOpenCohort={setOpenFinding}
        />
        <SectionCard
          icon={Users2}
          title="Volunteer & Leader Health"
          score={scores.volunteers ?? 0}
          findings={bySection.volunteers || []}
          onOpenCohort={setOpenFinding}
        />
        <SectionCard
          icon={Layers}
          title="Groups Health"
          score={scores.groups ?? 0}
          findings={bySection.groups || []}
          onOpenCohort={setOpenFinding}
        />

        <div className="text-center pt-4 print:hidden">
          <Button variant="ghost" onClick={() => navigate('/')}>
            <ArrowLeft className="h-4 w-4 mr-1.5" /> Go to my dashboard
          </Button>
        </div>
      </div>

      <CohortDialog
        finding={openFinding}
        organizationId={report.organization_id}
        onClose={() => setOpenFinding(null)}
      />
    </div>
  );
};

export default AuditReportPage;
