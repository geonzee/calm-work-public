/**
 * Project–calendar links (`$projectCalendars`) and per-event project choices
 * (`$eventMeta`) used to live inside the single `drafts` record. Sync resolves a
 * conflict per record, so a phone that only changed its capture draft could replace
 * the whole record and silently drop every link made on another device.
 *
 * Each link is now its own record, and a save only carries what the renderer
 * actually changed since it last loaded or saved (edits against a baseline). A map
 * that is empty or stale on this device can therefore never delete a link.
 */
export type LinkMap = Record<string, unknown>;
export type LinkMapName = 'projectCalendars' | 'eventMeta';
export const LINK_MAP_NAMES: readonly LinkMapName[] = ['projectCalendars', 'eventMeta'];

export interface LinkEdits {
  upserts: LinkMap;
  deletes: string[];
}

const FORBIDDEN = ['__proto__', 'prototype', 'constructor'];

/** Parse the renderer's JSON text; anything unreadable is treated as "unknown". */
export const parseLinkMap = (json: unknown): LinkMap | null => {
  if (typeof json !== 'string') return null;
  try {
    const value = JSON.parse(json) as unknown;
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const result: LinkMap = {};
    for (const [key, entry] of Object.entries(value as LinkMap))
      if (!FORBIDDEN.includes(key) && entry !== undefined) result[key] = entry;
    return result;
  } catch {
    return null;
  }
};

const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

/**
 * What did this device change? With a baseline, only keys whose value differs from
 * it are edits (a key missing from `mine` but present in the baseline is a real
 * deletion). Without a baseline nothing can be called a deletion, and a key is only
 * added when no other device already has a value for it.
 */
export const diffLinkMap = (
  mine: LinkMap | null,
  base: LinkMap | null,
  stored: LinkMap,
): LinkEdits => {
  if (!mine) return { upserts: {}, deletes: [] };
  if (!base) {
    const upserts: LinkMap = {};
    for (const [key, value] of Object.entries(mine))
      if (!(key in stored)) upserts[key] = value;
    return { upserts, deletes: [] };
  }
  const upserts: LinkMap = {};
  const deletes: string[] = [];
  for (const [key, value] of Object.entries(mine))
    if (!(key in base) || !same(value, base[key])) upserts[key] = value;
  for (const key of Object.keys(base)) if (!(key in mine)) deletes.push(key);
  return { upserts, deletes };
};

/** Apply edits on top of the records this device currently holds. */
export const applyLinkEdits = (stored: LinkMap, edits: LinkEdits): LinkMap => {
  const result: LinkMap = { ...stored };
  for (const key of edits.deletes) delete result[key];
  for (const [key, value] of Object.entries(edits.upserts)) result[key] = value;
  return result;
};
