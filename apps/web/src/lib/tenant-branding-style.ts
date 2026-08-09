function hexToRgb(hex: string): [number, number, number] | null {
  const m = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  const group = m?.[1];
  if (!group) return null;
  const int = parseInt(group, 16);
  return [(int >> 16) & 255, (int >> 8) & 255, int & 255];
}

function rgba(hex: string, alpha: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  return `rgba(${String(rgb[0])},${String(rgb[1])},${String(rgb[2])},${String(alpha)})`;
}

// Every token below defaults (in globals.css) to a shade of the stock
// blue/purple palette. Anything that's meant to read as "brand-colored" —
// not just the handful of literal --brand-* vars — needs to be re-derived
// here from the tenant's chosen colors, or it stays stuck on the old blue
// no matter what the tenant picks (e.g. borders, chart lines, sidebar glow).
export function buildBrandingStyle(branding: unknown): string {
  if (!branding || typeof branding !== 'object') return '';
  const b = branding as Record<string, unknown>;
  const vars: string[] = [];
  const primaryColor = typeof b.primaryColor === 'string' ? b.primaryColor : undefined;
  const accentColor = typeof b.accentColor === 'string' ? b.accentColor : undefined;
  const bgColor = typeof b.bgColor === 'string' ? b.bgColor : undefined;
  if (primaryColor && hexToRgb(primaryColor)) {
    vars.push(`--brand-primary:${primaryColor}`);
    vars.push(`--brand-secondary:${primaryColor}`);
    vars.push(`--sidebar-accent:${primaryColor}`);
    vars.push(`--status-info:${primaryColor}`);
    vars.push(`--chart-line:${primaryColor}`);
    vars.push(`--chart-area:${rgba(primaryColor, 0.1)}`);
    vars.push(`--border-light:${rgba(primaryColor, 0.12)}`);
    vars.push(`--border-default:${rgba(primaryColor, 0.22)}`);
    vars.push(`--sidebar-item-active:${rgba(primaryColor, 0.15)}`);
    vars.push(`--glow-blue:${rgba(primaryColor, 0.25)}`);
    vars.push(`--shadow-brand:0 4px 24px ${rgba(primaryColor, 0.15)}`);
  }
  if (accentColor && hexToRgb(accentColor)) {
    vars.push(`--brand-accent:${accentColor}`);
    vars.push(`--glow-purple:${rgba(accentColor, 0.2)}`);
  }
  if (primaryColor && accentColor)
    vars.push(`--brand-gradient:linear-gradient(135deg,${accentColor},${primaryColor})`);
  if (bgColor) vars.push(`--bg-main:${bgColor}`);
  return vars.length ? `:root{${vars.join(';')}}` : '';
}
