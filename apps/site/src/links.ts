const configured = (import.meta.env.PUBLIC_DASHBOARD_URL || '').replace(/\/+$/, '');
export const hasDashboard = Boolean(configured) || import.meta.env.DEV;
const dashboardUrl = configured || 'http://localhost:3000';

export const links = {
  /** Hidden when there's no dashboard to sign in to. */
  signIn: hasDashboard ? `${dashboardUrl}/sign-in` : undefined,
  /** Signing up when there's a dashboard; otherwise setting Signal up yourself. */
  signUp: hasDashboard ? `${dashboardUrl}/sign-up` : '/docs/self-hosting',
  docs: '/docs/introduction',
};
