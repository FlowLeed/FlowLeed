import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { CheckCircle, Clock, XCircle, AlertCircle, PauseCircle } from 'lucide-react';

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export const StatusBadge = ({ status, className }: StatusBadgeProps) => {
  const getStatusConfig = () => {
    switch (status.toLowerCase()) {
      case 'active':
        return {
          icon: CheckCircle,
          color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
          label: 'Active'
        };
      case 'trial':
        return {
          icon: Clock,
          color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
          label: 'Trial'
        };
      case 'canceled':
      case 'cancelled':
        return {
          icon: XCircle,
          color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
          label: 'Canceled'
        };
      case 'past_due':
        return {
          icon: AlertCircle,
          color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
          label: 'Past Due'
        };
      case 'suspended':
        return {
          icon: PauseCircle,
          color: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400',
          label: 'Suspended'
        };
      default:
        return {
          icon: AlertCircle,
          color: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400',
          label: status
        };
    }
  };

  const config = getStatusConfig();
  const Icon = config.icon;

  return (
    <Badge variant="outline" className={cn(config.color, 'font-medium gap-1', className)}>
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
  );
};
