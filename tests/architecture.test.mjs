import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultFeatures, modules, primaryFeatures, resolveFeatures } from '../output/build/packages/modules/src/index.js';
import { assertMirrorWritable, validateTimedRange } from '../output/build/packages/calendar/src/index.js';
import { calendarScopes, desktopAuthorizationUrl } from '../output/build/packages/calendar/src/oauth.js';
import { persistencePolicy } from '../output/build/packages/sync/src/index.js';
import { executeAutomation } from '../output/build/packages/automation/src/index.js';

const calendar = { provider: 'google', accountId: 'synthetic-account', calendarId: 'synthetic-calendar' };
const range = { kind: 'timed', start: '2026-10-13T09:00:00+08:00', end: '2026-10-13T09:30:00+08:00', timeZone: 'Asia/Hong_Kong' };
const event = { id: 'fixture-event', calendar, title: 'Synthetic task', range, revision: 'fixture-etag', busy: true, ownership: 'app-mirror', taskId: 'fixture-task' };
const policy = { enabled: true, destination: calendar };
const auth = { provider: 'google', clientId: 'fixture-client', redirectUri: 'http://127.0.0.1:49152/oauth/callback', state: 's'.repeat(32), codeChallenge: 'c'.repeat(43), allowCalendarWrites: false };

test('default task/tracking configuration enables no network module', () => {
  const enabled = resolveFeatures(defaultFeatures);
  assert.deepEqual(enabled, ['tasks', 'tracking']);
  assert.ok(modules.filter(m => enabled.includes(m.id)).every(m => m.mode === 'local'));
});

test('blocking works without calendar, sync, booking or team modules', () => {
  assert.deepEqual(resolveFeatures(['blocking']), ['tasks', 'blocking']);
});

test('booking resolves dependencies once without activating team or personal sync', () => {
  assert.deepEqual(resolveFeatures(['booking', 'booking']), ['tasks', 'blocking', 'calendars', 'booking']);
});

test('team explicitly depends on project and sync boundaries', () => {
  assert.deepEqual(resolveFeatures(['team']), ['tasks', 'projects', 'sync', 'team']);
  assert.throws(() => resolveFeatures(['unknown']), /Unknown module/);
});

test('mobile primary surface contains only tasks and tracking', () => {
  assert.deepEqual(primaryFeatures('mobile'), ['tasks', 'tracking']);
});

test('write guard requires opt-in and rejects externally owned events', () => {
  assert.doesNotThrow(() => assertMirrorWritable(event, policy));
  assert.throws(() => assertMirrorWritable(event, { ...policy, enabled: false }), /disabled/);
  assert.throws(() => assertMirrorWritable({ ...event, ownership: 'external' }, policy), /read-only/);
  assert.throws(() => assertMirrorWritable({ ...event, taskId: undefined }, policy), /read-only/);
});

test('write guard isolates provider, account and calendar', () => {
  for (const changed of [{ provider: 'microsoft' }, { accountId: 'another-account' }, { calendarId: 'another-calendar' }]) {
    assert.throws(() => assertMirrorWritable(event, { enabled: true, destination: { ...calendar, ...changed } }), /mismatch/);
  }
});

test('time blocks require offsets, positive duration and a real timezone', () => {
  assert.doesNotThrow(() => validateTimedRange(range));
  assert.throws(() => validateTimedRange({ ...range, end: range.start }), /ordered/);
  assert.throws(() => validateTimedRange({ ...range, start: '2026-10-13T09:00:00' }), /zoned/);
  assert.throws(() => validateTimedRange({ ...range, timeZone: 'Invalid/Zone' }), RangeError);
});

test('DST fallback duration is calculated from instants', () => {
  const dst = { kind: 'timed', start: '2026-11-01T01:30:00-04:00', end: '2026-11-01T01:30:00-05:00', timeZone: 'America/New_York' };
  assert.doesNotThrow(() => validateTimedRange(dst));
  assert.equal(Date.parse(dst.end) - Date.parse(dst.start), 3_600_000);
});

test('OAuth requests read access before separately enabled write access', () => {
  assert.deepEqual(calendarScopes('google', false), ['https://www.googleapis.com/auth/calendar.readonly']);
  assert.ok(calendarScopes('google', true).includes('https://www.googleapis.com/auth/calendar.events.owned'));
  assert.deepEqual(calendarScopes('microsoft', false), ['openid', 'offline_access', 'Calendars.Read']);
  assert.ok(calendarScopes('microsoft', true).includes('Calendars.ReadWrite'));
});

test('desktop OAuth request uses code, S256, state and offline access', () => {
  const google = new URL(desktopAuthorizationUrl(auth));
  assert.equal(google.origin, 'https://accounts.google.com');
  assert.equal(google.searchParams.get('response_type'), 'code');
  assert.equal(google.searchParams.get('code_challenge_method'), 'S256');
  assert.equal(google.searchParams.get('state'), auth.state);
  assert.equal(google.searchParams.get('access_type'), 'offline');
  assert.equal(google.searchParams.has('client_secret'), false);
  const microsoft = new URL(desktopAuthorizationUrl({ ...auth, provider: 'microsoft' }));
  assert.equal(microsoft.pathname, '/organizations/oauth2/v2.0/authorize');
  assert.equal(microsoft.searchParams.get('scope'), 'openid offline_access Calendars.Read');
});

test('desktop URL builder rejects non-loopback and malformed OAuth inputs', () => {
  for (const redirectUri of ['https://example.com/callback', 'http://192.168.0.2:1234/callback', 'http://127.0.0.1/callback', 'http://evil@127.0.0.1:1234/', 'http://127.0.0.1:1234/?token=fixture', 'calm-work://callback']) {
    assert.throws(() => desktopAuthorizationUrl({ ...auth, redirectUri }), /loopback/);
  }
  assert.throws(() => desktopAuthorizationUrl({ ...auth, state: '' }), /random state/);
  assert.throws(() => desktopAuthorizationUrl({ ...auth, codeChallenge: 'short' }), /S256/);
  assert.doesNotThrow(() => desktopAuthorizationUrl({ ...auth, redirectUri: 'http://[::1]:49152/callback' }));
  assert.throws(() => desktopAuthorizationUrl({ ...auth, provider: 'microsoft', redirectUri: 'http://[::1]:49152/callback' }), /loopback/);
});

test('secrets and provider caches are excluded from synced task persistence policy', () => {
  assert.equal(persistencePolicy.tasks, 'upstream-operation-log');
  assert.equal(persistencePolicy.oauthCredentials, 'device-vault');
  assert.equal(persistencePolicy.pkceVerifier, 'ephemeral');
  assert.equal(persistencePolicy.calendarCursor, 'device-local');
});

test('AI commands carry stable IDs to the same local command port without network I/O', async () => {
  // Fake boundary validates routing only, not database durability or deduplication.
  const request = { commandId: 'fixture-command', command: { kind: 'timer.start', taskId: 'fixture-task' } };
  const local = { execute: async (commandId, command) => {
    assert.equal(commandId, request.commandId);
    assert.deepEqual(command, request.command);
    return { commandId, durability: 'local-durable' };
  } };
  assert.equal((await executeAutomation(request, local)).commandId, request.commandId);
  assert.throws(() => executeAutomation({ ...request, commandId: '' }, local), /command ID/);
});
