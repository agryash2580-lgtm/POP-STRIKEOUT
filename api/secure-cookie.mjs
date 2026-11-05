// HTTPS terminates at the reverse proxy in self-hosted production.
export const secureCookies = (env = process.env) =>
  Boolean(env.VERCEL) || env.NODE_ENV === 'production';
