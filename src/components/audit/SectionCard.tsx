import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowRight, TrendingDown, AlertTriangle, Users } from 'lucide-react';
import { scoreColor } from './ScoreGauge';
import type { LucideIcon } from 'lucide-react';

export interface Finding {
  id: string;
  key: string;
  section: string;
  title: string;
  description: string | null;
  severity: 'low' | 'medium' | 'high';
  metric_value: number;
  metric_label: string | null;
  contact_ids: string[];
  sort_order: number;
}

interface SectionCardProps {
  icon: LucideIcon;
  title: string;
  score: number;
  findings: Finding[];
  onOpenCohort: (finding: Finding) => void;
}

const gradeFor = (score: number) => {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
};

const severityBadge: Record<Finding['severity'], { label: string; className: string }> = {
  low: { label: 'Low', className: 'bg-blue-50 text-blue-700 border-blue-200' },
  medium: { label: 'Medium', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  high: { label: 'High', className: 'bg-red-50 text-red-700 border-red-200' },
};

export const SectionCard = ({ icon: Icon, title, score, findings, onOpenCohort }: SectionCardProps) => {
  const color = scoreColor(score);
  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b bg-muted/30">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Icon className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-lg">{title}</h3>
            <p className="text-xs text-muted-foreground">Score {score}/100</p>
          </div>
        </div>
        <div className="text-3xl font-bold" style={{ color }}>{gradeFor(score)}</div>
      </CardHeader>
      <CardContent className="p-0">
        <ul className="divide-y">
          {findings.map((f) => {
            const sev = severityBadge[f.severity];
            const hasPeople = f.contact_ids.length > 0;
            return (
              <li key={f.id} className="p-4 hover:bg-muted/30 transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{f.title}</span>
                      <Badge variant="outline" className={sev.className}>{sev.label}</Badge>
                    </div>
                    {f.description && (
                      <p className="text-sm text-muted-foreground mt-1">{f.description}</p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-2xl font-bold">{f.metric_value.toLocaleString()}</div>
                    {f.metric_label && (
                      <div className="text-xs text-muted-foreground">{f.metric_label}</div>
                    )}
                  </div>
                </div>
                {hasPeople && (
                  <div className="mt-3 flex items-center justify-between">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Users className="h-3.5 w-3.5" />
                      {f.contact_ids.length} {f.contact_ids.length === 1 ? 'person' : 'people'} identified
                    </div>
                    <Button size="sm" variant="outline" onClick={() => onOpenCohort(f)}>
                      View all & add to Flow
                      <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
                    </Button>
                  </div>
                )}
              </li>
            );
          })}
          {findings.length === 0 && (
            <li className="p-6 text-center text-sm text-muted-foreground flex flex-col items-center gap-2">
              <TrendingDown className="h-5 w-5" />
              No findings for this section.
            </li>
          )}
        </ul>
      </CardContent>
    </Card>
  );
};
