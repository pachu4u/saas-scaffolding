import type { HealthStatus } from '@/lib/system-health';

export const STATUS_LABEL: Record<HealthStatus, string> = {
  healthy: 'Healthy',
  degraded: 'Degraded',
  down: 'Down',
};
export const STATUS_BADGE: Record<HealthStatus, 'success' | 'warning' | 'error'> = {
  healthy: 'success',
  degraded: 'warning',
  down: 'error',
};
export const STATUS_DOT: Record<HealthStatus, string> = {
  healthy: 'var(--status-success)',
  degraded: 'var(--status-warning)',
  down: '#DC2626',
};
