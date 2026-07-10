import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Printer, LayoutDashboard, HeartPulse, Users2, Layers, ArrowLeft } from 'lucide-react';
import { ScoreGauge } from '@/components/audit/ScoreGauge';
import { SectionCard, type Finding } from '@/components/audit/SectionCard';
import { CohortDialog } from '@/components/audit/CohortDialog';
import flowleedLogo from '@/assets/flowleed_logo_new.png';
import { toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';
import { toast } from 'sonner';
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
  const [exporting, setExporting] = useState(false);
  const pdfRootRef = useRef<HTMLDivElement>(null);

  const handleExportPDF = async () => {
    const root = pdfRootRef.current;
    if (!root) return;
    setExporting(true);
    try {
      // Ensure webfonts are ready so text metrics are accurate
      if ((document as any).fonts?.ready) {
        try { await (document as any).fonts.ready; } catch {}
      }

      const sections = Array.from(root.querySelectorAll<HTMLElement>('[data-pdf-section]'));
      if (sections.length === 0) return;

      const A4_W = 210, A4_H = 297, M = 12;
      const CW = A4_W - M * 2;
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      let y = M;

      for (let i = 0; i < sections.length; i++) {
        const el = sections[i];
        const rect = el.getBoundingClientRect();
        const dataUrl = await toPng(el, {
          pixelRatio: 2,
          cacheBust: true,
          backgroundColor: '#ffffff',
          width: rect.width,
          height: rect.height,
          style: { transform: 'none' },
        });
        // Load image to read intrinsic dimensions
        const img = await new Promise<HTMLImageElement>((resolve, reject) => {
          const i = new Image();
          i.onload = () => resolve(i);
          i.onerror = reject;
          i.src = dataUrl;
        });
        const hMM = (img.height / img.width) * CW;
        if (y > M && y + hMM > A4_H - M) {
          pdf.addPage();
          y = M;
        }
        pdf.addImage(dataUrl, 'PNG', M, y, CW, hMM);
        y += hMM + 4;
      }

      pdf.save(`church-health-report-${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (e) {
      console.error(e);
      toast.error('Failed to export PDF');
    } finally {
      setExporting(false);
    }
  };

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
            <Button variant="outline" size="sm" onClick={handleExportPDF} disabled={exporting}>
              {exporting ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Printer className="h-4 w-4 mr-1.5" />}
              {exporting ? 'Exporting…' : 'Export PDF'}
            </Button>
          </div>
        </div>
      </header>

      <div ref={pdfRootRef} className="max-w-6xl mx-auto px-4 py-8 space-y-8">
        <div data-pdf-section className="text-center space-y-2">
          <div className="text-sm text-muted-foreground">Church Health Report</div>
          <h1 className="text-3xl md:text-4xl font-bold">{organization?.name || 'Your Church'}</h1>
          {report.generated_at && (
            <div className="text-xs text-muted-foreground">
              Generated {new Date(report.generated_at).toLocaleString()}
            </div>
          )}
        </div>

        <Card data-pdf-section>
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

        <div data-pdf-section>
          <SectionCard
            icon={HeartPulse}
            title="At-Risk People"
            score={scores.at_risk ?? 0}
            findings={bySection.at_risk || []}
            onOpenCohort={setOpenFinding}
          />
        </div>
        <div data-pdf-section>
          <SectionCard
            icon={Users2}
            title="Volunteer & Leader Health"
            score={scores.volunteers ?? 0}
            findings={bySection.volunteers || []}
            onOpenCohort={setOpenFinding}
          />
        </div>
        <div data-pdf-section>
          <SectionCard
            icon={Layers}
            title="Groups Health"
            score={scores.groups ?? 0}
            findings={bySection.groups || []}
            onOpenCohort={setOpenFinding}
          />
        </div>

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
