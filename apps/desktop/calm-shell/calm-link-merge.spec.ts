import {
  applyLinkEdits,
  diffLinkMap,
  LinkMap,
  parseLinkMap,
} from './calm-link-merge';

/**
 * A device keeps one record per link plus a small shared "drafts" record. Sync resolves
 * a conflict per record, last write wins. This mirrors CalmWorkspaceService, which saves
 * a link only when this device changed it against the baseline it last loaded or saved.
 */
interface Row {
  value: unknown;
  at: number;
}
class Device {
  links = new Map<string, Row>();
  drafts: Row = { value: { capture: '' }, at: 0 };
  base: LinkMap | null = {};
  mine: LinkMap = {};
  constructor(private _clock: { now: number }) {}

  stored(): LinkMap {
    return Object.fromEntries([...this.links].map(([key, row]) => [key, row.value]));
  }
  /** Renderer hydrate: show what the host holds and remember it as the baseline. */
  hydrate(): void {
    this.mine = this.stored();
    this.base = this.stored();
  }
  edit(change: (links: LinkMap) => void): void {
    change(this.mine);
  }
  /** Renderer commit: always sends its maps, plus a changed capture draft. */
  commit(capture: string): void {
    const edits = diffLinkMap(this.mine, this.base, this.stored());
    for (const key of edits.deletes) this.links.delete(key);
    for (const [key, value] of Object.entries(edits.upserts))
      this.links.set(key, { value, at: ++this._clock.now });
    this.drafts = { value: { capture }, at: ++this._clock.now };
    this.base = structuredClone(this.mine);
  }
}
/** Two-way sync: each record keeps the newer copy. */
const sync = (a: Device, b: Device): void => {
  for (const [from, to] of [
    [a, b],
    [b, a],
  ] as const) {
    for (const [key, row] of from.links) {
      const other = to.links.get(key);
      if (!other || other.at < row.at) to.links.set(key, { ...row });
    }
    if (to.drafts.at < from.drafts.at) to.drafts = { ...from.drafts };
  }
};

describe('project–calendar links across a phone resync', () => {
  let clock: { now: number };
  let desktop: Device;
  let phone: Device;
  beforeEach(() => {
    clock = { now: 0 };
    desktop = new Device(clock);
    phone = new Device(clock);
  });

  it('keeps links the phone never saw when the phone hydrates, edits and commits', () => {
    desktop.hydrate();
    desktop.edit((links) => (links['Product launch'] = 'google|work'));
    desktop.commit('');
    // The phone loaded before it had synced, then changed only its own draft.
    phone.hydrate();
    phone.edit(() => undefined);
    phone.commit('Buy milk');
    sync(desktop, phone);
    expect(desktop.stored()).toEqual({ 'Product launch': 'google|work' });
    expect(phone.stored()).toEqual({ 'Product launch': 'google|work' });
  });

  it('keeps links when the phone holds a stale map and then commits a change of its own', () => {
    desktop.hydrate();
    desktop.edit((links) => (links['Alpha'] = 'google|a'));
    desktop.commit('');
    sync(desktop, phone);
    phone.hydrate();
    // The desktop adds another link while the phone is open and not yet refreshed.
    desktop.edit((links) => (links['Beta'] = 'google|b'));
    desktop.commit('');
    sync(desktop, phone);
    phone.edit((links) => (links['Gamma'] = 'caldav|c'));
    phone.commit('');
    sync(desktop, phone);
    const expected = { Alpha: 'google|a', Beta: 'google|b', Gamma: 'caldav|c' };
    expect(phone.stored()).toEqual(expected);
    expect(desktop.stored()).toEqual(expected);
  });

  it('still deletes a link the user removed on this device', () => {
    desktop.hydrate();
    desktop.edit((links) => (links['Alpha'] = 'google|a'));
    desktop.commit('');
    sync(desktop, phone);
    phone.hydrate();
    phone.edit((links) => delete links['Alpha']);
    phone.commit('');
    expect(phone.stored()).toEqual({});
  });

  it('an unreadable or missing baseline never deletes, and only adds absent keys', () => {
    const stored = { Alpha: 'google|a' };
    expect(diffLinkMap({}, null, stored)).toEqual({ upserts: {}, deletes: [] });
    expect(diffLinkMap(null, {}, stored)).toEqual({ upserts: {}, deletes: [] });
    expect(diffLinkMap({ Alpha: 'other', Beta: 'x' }, null, stored)).toEqual({
      upserts: { Beta: 'x' },
      deletes: [],
    });
  });

  it('an empty map against an empty baseline leaves every stored link alone', () => {
    const stored = { Alpha: 'google|a' };
    const edits = diffLinkMap({}, {}, stored);
    expect(applyLinkEdits(stored, edits)).toEqual(stored);
  });

  it('renames travel as one delete and one upsert', () => {
    const edits = diffLinkMap({ New: 'google|a' }, { Old: 'google|a' }, { Old: 'google|a' });
    expect(edits).toEqual({ upserts: { New: 'google|a' }, deletes: ['Old'] });
  });

  it('compares structured values, as used by per-event project choices', () => {
    const base = { 'event:1': { project: 'A' } };
    expect(diffLinkMap({ 'event:1': { project: 'A' } }, base, base).upserts).toEqual({});
    expect(diffLinkMap({ 'event:1': { project: 'B' } }, base, base).upserts).toEqual({
      'event:1': { project: 'B' },
    });
  });

  it('reads only JSON objects and drops unsafe keys', () => {
    expect(parseLinkMap('[1]')).toBeNull();
    expect(parseLinkMap('nope')).toBeNull();
    expect(parseLinkMap(undefined)).toBeNull();
    expect(parseLinkMap('{"__proto__":1,"a":2}')).toEqual({ a: 2 });
  });
});
