/** Local defaults plus one hosted Node service; no Twitch credentials needed for replay. */
export function readServerConfig(env = process.env) {
  const origin = new URL(env.APP_ORIGIN || env.RENDER_EXTERNAL_URL || new URL(env.TWITCH_REDIRECT_URI || 'http://localhost:3000/auth/callback').origin);
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname);
  if (origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash || (local ? origin.protocol !== 'http:' : origin.protocol !== 'https:')) throw new Error('APP_ORIGIN must be a plain http://localhost or public https:// origin.');
  const redirectUri = env.TWITCH_REDIRECT_URI || `${origin.origin}/auth/callback`;
  if (redirectUri !== `${origin.origin}/auth/callback`) throw new Error('TWITCH_REDIRECT_URI must match APP_ORIGIN + /auth/callback.');
  const port = Number(env.PORT || origin.port || 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be a whole number between 1 and 65535.');
  const twitchEnabled = !!(env.TWITCH_CLIENT_ID && env.TWITCH_CLIENT_SECRET);
  if (!!env.TWITCH_CLIENT_ID !== !!env.TWITCH_CLIENT_SECRET) throw new Error('Set both Twitch client values, or leave both unset for replay only.');
  if (!local && twitchEnabled && !env.DASHBOARD_PASSWORD) throw new Error('Set DASHBOARD_PASSWORD before enabling hosted Twitch controls.');
  return {origin: origin.origin, redirectUri, port, host: local && env.RENDER !== 'true' ? '127.0.0.1' : '0.0.0.0', twitchEnabled, dashboardPassword: env.DASHBOARD_PASSWORD || ''};
}
