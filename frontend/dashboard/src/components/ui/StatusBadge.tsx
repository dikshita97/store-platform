import { CheckCircle, Loader2, Clock, XCircle, AlertCircle } from 'lucide-react';
import { StoreStatus } from '../../types';

interface StatusBadgeProps {
  status: StoreStatus;
  showIcon?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const statusConfig: Record<StoreStatus, { label: string; color: string; icon: React.ReactNode }> = {
  pending: {
    label: 'Pending',
    color: 'bg-gray-100 text-gray-600 border-gray-300',
    icon: <Clock className="w-4 h-4" />,
  },
  provisioning: {
    label: 'Provisioning',
    color: 'bg-warning-50 text-warning-700 border-warning-500',
    icon: <Loader2 className="w-4 h-4 animate-spin" />,
  },
  running: {
    label: 'Running',
    color: 'bg-success-50 text-success-700 border-success-500',
    icon: <CheckCircle className="w-4 h-4" />,
  },
  failed: {
    label: 'Failed',
    color: 'bg-error-50 text-error-700 border-error-500',
    icon: <XCircle className="w-4 h-4" />,
  },
  deleting: {
    label: 'Deleting',
    color: 'bg-gray-100 text-gray-600 border-gray-300',
    icon: <Loader2 className="w-4 h-4 animate-spin" />,
  },
  deleted: {
    label: 'Deleted',
    color: 'bg-gray-100 text-gray-500 border-gray-300',
    icon: <AlertCircle className="w-4 h-4" />,
  },
};

const sizeClasses = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-3 py-1 text-sm',
  lg: 'px-4 py-1.5 text-base',
};

export function StatusBadge({ status, showIcon = true, size = 'md' }: StatusBadgeProps) {
  const config = statusConfig[status] || statusConfig.pending;

  return (
    <span
      className={`
        inline-flex items-center gap-1.5 rounded-full border font-medium
        ${config.color}
        ${sizeClasses[size]}
      `}
    >
      {showIcon && config.icon}
      {config.label}
    </span>
  );
}

export default StatusBadge;
