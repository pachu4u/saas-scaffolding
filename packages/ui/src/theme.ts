export interface BrandTheme {
  primaryColor: string;
  secondaryColor: string;
  logoUrl?: string;
  faviconUrl?: string;
  name: string;
}

export const DEFAULT_THEME: BrandTheme = {
  primaryColor: '#3b82f6',
  secondaryColor: '#1d4ed8',
  name: 'SaaS Platform',
};

export function themeToCssVars(theme: BrandTheme): Record<string, string> {
  return {
    '--brand-primary': theme.primaryColor,
    '--brand-secondary': theme.secondaryColor,
    '--brand-500': theme.primaryColor,
    '--brand-600': theme.secondaryColor,
  };
}

export function parseBranding(branding: unknown): BrandTheme {
  if (!branding || typeof branding !== 'object') return DEFAULT_THEME;
  const b = branding as Record<string, unknown>;
  return {
    primaryColor: (b.primaryColor as string | undefined) ?? DEFAULT_THEME.primaryColor,
    secondaryColor: (b.secondaryColor as string | undefined) ?? DEFAULT_THEME.secondaryColor,
    ...(b.logoUrl ? { logoUrl: b.logoUrl as string } : {}),
    ...(b.faviconUrl ? { faviconUrl: b.faviconUrl as string } : {}),
    name: (b.name as string | undefined) ?? DEFAULT_THEME.name,
  };
}
