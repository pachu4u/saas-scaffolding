export const activityTypeConfig = {
  team: { variant: 'blue' as const, label: 'Team' },
  billing: { variant: 'purple' as const, label: 'Billing' },
  scim: { variant: 'success' as const, label: 'SCIM' },
  api: { variant: 'default' as const, label: 'API' },
  error: { variant: 'error' as const, label: 'Error' },
  settings: { variant: 'warning' as const, label: 'Settings' },
  auth: { variant: 'gray' as const, label: 'Auth' },
};

export type ActivityType = keyof typeof activityTypeConfig;

export function getActivityType(action: string): ActivityType {
  const a = action.toLowerCase();
  if (a.includes('billing') || a.includes('subscription') || a.includes('plan')) return 'billing';
  if (a.includes('scim')) return 'scim';
  if (a.includes('fail') || a.includes('error')) return 'error';
  if (a.includes('webhook') || a.includes('apikey') || a.includes('api_key')) return 'api';
  if (a.includes('settings') || a.includes('branding') || a.includes('domain')) return 'settings';
  if (a.includes('signin') || a.includes('signout') || a.includes('session')) return 'auth';
  return 'team';
}

export function humanizeAction(action: string): string {
  return action
    .split(/[._]/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}
