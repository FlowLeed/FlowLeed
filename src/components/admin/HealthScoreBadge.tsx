import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface HealthScoreBadgeProps {
  score: number;
  className?: string;
}

export const HealthScoreBadge = ({ score, className }: HealthScoreBadgeProps) => {
  const getVariant = () => {
    if (score >= 75) return 'default';
    if (score >= 50) return 'secondary';
    return 'destructive';
  };

  const getColor = () => {
    if (score >= 75) return 'text-green-600 bg-green-100 dark:bg-green-900/30 dark:text-green-400';
    if (score >= 50) return 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30 dark:text-yellow-400';
    return 'text-red-600 bg-red-100 dark:bg-red-900/30 dark:text-red-400';
  };

  return (
    <Badge 
      variant={getVariant()} 
      className={cn(getColor(), 'font-semibold', className)}
    >
      {score}/100
    </Badge>
  );
};
