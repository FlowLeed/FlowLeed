import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface PlanTierBadgeProps {
  tier: string;
  className?: string;
}

export const PlanTierBadge = ({ tier, className }: PlanTierBadgeProps) => {
  const getColor = () => {
    switch (tier.toLowerCase()) {
      case 'trial':
        return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
      case 'starter':
        return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
      case 'growth':
        return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400';
      case 'enterprise':
        return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400';
      case 'custom':
        return 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400';
      default:
        return 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400';
    }
  };

  return (
    <Badge variant="outline" className={cn(getColor(), 'font-medium', className)}>
      {tier.charAt(0).toUpperCase() + tier.slice(1)}
    </Badge>
  );
};
