const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { execFileSync } = require('node:child_process');
const { resolve } = require('node:path');
const root = resolve(__dirname, '..');
test('public launcher selects separate app and profile with no host writes', () => {
  const script = readFileSync(resolve(root, 'apps/desktop/linux/calm-work-launcher.sh'), 'utf8');
  // Stop before filesystem operations and print the actual shell-resolved defaults.
  const preamble = script.slice(0, script.indexOf('if [[ ! -x'));
  const actual = execFileSync('bash', ['-c', preamble + '\nprintf "%s\\n%s\\n" "$app" "$profile"'], {
    env: { HOME: '/tmp/synthetic-public-home', PATH: process.env.PATH }, encoding: 'utf8',
  });
  assert.equal(actual, '/tmp/synthetic-public-home/.local/opt/calm-work-public/current/superproductivity\n/tmp/synthetic-public-home/.local/share/calm-work-public\n');
});
test('public desktop entry does not claim the daily URL handler', () => {
  const installer = readFileSync(resolve(root, 'scripts/install-linux-launcher.py'), 'utf8');
  assert.ok(installer.includes("'calm-work-public.desktop'"));
  assert.ok(!installer.includes('MimeType=x-scheme-handler/calm-work;'));
});
