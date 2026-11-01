import type { Provider } from '../../core/src/index.js';

const googleRoot = 'https://www.googleapis.com/auth/';
export function calendarScopes(provider: Provider, write: boolean): readonly string[] {
  return provider === 'google'
    ? [googleRoot + 'calendar.readonly', ...(write ? [googleRoot + 'calendar.events.owned'] : [])]
    : ['openid', 'offline_access', write ? 'Calendars.ReadWrite' : 'Calendars.Read'];
}

export interface DesktopAuthorization {
  readonly provider: Provider;
  readonly clientId: string;
  readonly redirectUri: string;
  readonly state: string;
  readonly codeChallenge: string;
  readonly allowCalendarWrites: boolean;
}

/** URL policy only; no OAuth listener, token exchange or credential storage. */
export function desktopAuthorizationUrl(config: DesktopAuthorization): string {
  const redirect = new URL(config.redirectUri);
  const loopbackHosts = config.provider === 'google' ? ['127.0.0.1', '[::1]'] : ['127.0.0.1'];
  if (redirect.protocol !== 'http:' || !loopbackHosts.includes(redirect.hostname) || !redirect.port || redirect.username || redirect.password || redirect.search || redirect.hash) {
    throw new Error('Desktop OAuth requires an explicit loopback port');
  }
  if (!config.clientId.trim() || !/^[A-Za-z0-9_-]{32,}$/.test(config.state) || !/^[A-Za-z0-9_-]{43}$/.test(config.codeChallenge)) {
    throw new Error('OAuth requires a client ID, random state and an S256 challenge');
  }
  const url = new URL(config.provider === 'google'
    ? 'https://accounts.google.com/o/oauth2/v2/auth'
    : 'https://login.microsoftonline.com/organizations/oauth2/v2.0/authorize');
  url.searchParams.set('client_id', config.clientId);
  url.searchParams.set('redirect_uri', redirect.href);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', calendarScopes(config.provider, config.allowCalendarWrites).join(' '));
  url.searchParams.set('state', config.state);
  url.searchParams.set('code_challenge', config.codeChallenge);
  url.searchParams.set('code_challenge_method', 'S256');
  if (config.provider === 'google') url.searchParams.set('access_type', 'offline');
  return url.href;
}
