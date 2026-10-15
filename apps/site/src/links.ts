/** The dashboard this site sends people to, e.g. `https://app.signal.example`. */
export const DASHBOARD_URL = (
  import.meta.env.PUBLIC_DASHBOARD_URL ?? 'http://localhost:3000'
).replace(/\/+$/, '');

export const links = {
  signIn: `${DASHBOARD_URL}/sign-in`,
  signUp: `${DASHBOARD_URL}/sign-up`,
  docs: '/docs/introduction',
};
