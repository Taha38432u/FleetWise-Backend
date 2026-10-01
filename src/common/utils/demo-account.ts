export const DEMO_EMAIL_DOMAIN = 'demo.com';

export function isDemoEmail(email?: string | null): boolean {
  if (!email) return false;
  return email.trim().toLowerCase().endsWith(`@${DEMO_EMAIL_DOMAIN}`);
}
