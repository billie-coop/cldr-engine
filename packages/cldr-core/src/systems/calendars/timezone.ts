import { MetaZoneType } from '@phensley/cldr-types';
import { keyIndexGet, TimeZoneStableIdIndex } from '../../schema';
import { tzFromUTC, tzResolveId, tzUtcZone, tzZoneIds } from '@phensley/timezone';

import { zoneAliasRaw } from './autogen.aliases';
import { metazoneData } from './autogen.zonedata';
import { numarray, stringToObject } from '../../utils/string';

/**
 * Time zone information carried by a calendar date.
 *
 * @public
 */
export interface DateZoneInfo {
  zoneid: string;
  stableid: string;
  abbr: string;
  dst: number;
  offset: number;
  metazoneid: string;
}

interface MetazoneRecord {
  offsets: number[];
  untils: number[];
}

export const zoneInfoFromUTC = (zoneid: string, utc: number): DateZoneInfo => {
  const mz = getMetazones();

  let tzinfo = tzFromUTC(zoneid, utc);
  if (tzinfo === undefined) {
    tzinfo = tzUtcZone();
  }

  // For the purposes of CLDR stable timezone ids, check if the passed-in
  // id is an alias to a current/valid tzdb id.
  const isstable = keyIndexGet(TimeZoneStableIdIndex, zoneid) !== -1;

  // Use the passed-in id as the stable id if it is an alias,
  // otherwise lookup the id in the stable map.
  const stableid = isstable ? zoneid : getStableId(mz, tzinfo.zoneid);

  // Use the corrected zone id to lookup the metazone
  const metazoneid = getMetazone(mz, tzinfo.zoneid, utc);
  return {
    ...tzinfo,
    metazoneid: metazoneid || ('' as MetaZoneType),
    stableid,
  };
};

export const currentMetazone = (id: string): string | undefined =>
  getMetazone(getMetazones(), id, Number.MAX_SAFE_INTEGER);

/**
 * Map a given timezone identifier to a CLDR stable timezone id.
 * This is lighter-weight than going through `zoneInfoFromUTC`
 * since it doesn't need to decode the zone data.
 */
export const getStableTimeZoneId = (zoneid: string): string => {
  const mz = getMetazones();
  // Check if this is already a CLDR stable timezone id.
  const isstable = keyIndexGet(TimeZoneStableIdIndex, zoneid) !== -1;
  if (isstable) {
    return zoneid;
  }
  // Resolve the passed-in string to a real tzdb zone id
  const realid = tzResolveId(zoneid);
  if (realid) {
    // Map to a CLDR stable id
    return getStableId(mz, realid);
  }
  return '';
};

/**
 * Maps a possible timezone alias to the correct id.
 */
export const substituteZoneAlias = (id: string): string => timeZoneAliases[id] || id;

/**
 * Index of all metazone information for quick access.
 */
interface Metazones {
  readonly metazoneids: string[];
  readonly metazones: MetazoneRecord[];
  readonly zoneToMetazone: Map<string, number>;
  readonly stableids: Map<string, string>;
}

const buildMetazones = (raw: any): Metazones => {
  const metazoneids: string[] = raw.metazoneids;
  const metazones: MetazoneRecord[] = [];
  const zoneToMetazone: Map<string, number> = new Map();
  const stableids: Map<string, string> = new Map();

  const index = numarray(raw.index, 36);
  const offsets = numarray(raw.offsets, 36);
  const untils = numarray(raw.untils, 36).map((n) => (n === -1 ? n : n * 1000));

  for (let i = 0; i < index.length; i += 2) {
    const s = index[i];
    const e = index[i + 1];
    const rec = {
      offsets: offsets.slice(s, e),
      untils: untils.slice(s, e),
    };
    metazones.push(rec);
  }

  // mapping of zoneid to metazone records
  const zoneids = tzZoneIds();
  const zoneindex = numarray(raw.zoneindex, 36);

  // Mapping of tzdb id back to cldr stable id used for schema lookups
  raw.stableids.split('|').forEach((d: string) => {
    const p = d.split(':');
    const i = Number(p[0]);
    stableids.set(zoneids[i], p[1]);
  });

  // Sanity-check, since the zoneindex is based off the canonical
  // zoneids array, but could be generated at different times. our test
  // cases should ensure they're in sync, but warn of a discrepancy
  /* istanbul ignore if -- @preserve */
  if (zoneids.length !== zoneindex.length) {
    console.log(`Error: time zone ids and zone index are not in sync!`, zoneids.length, '!=', zoneindex.length);
  }

  for (let i = 0; i < zoneindex.length; i++) {
    const mi = zoneindex[i];
    if (mi !== -1) {
      zoneToMetazone.set(zoneids[i], mi);
      zoneToMetazone.set(zoneids[i].toLowerCase(), mi);
    }
  }
  return { metazoneids, metazones, zoneToMetazone, stableids };
};

const getMetazone = (m: Metazones, zoneid: string, utc: number): string | undefined => {
  const i = m.zoneToMetazone.get(zoneid);
  if (i !== undefined) {
    const rec = m.metazones[i]!;
    // Note: we don't bother with binary search here since the metazone
    // until arrays are quite short.
    const { offsets, untils } = rec;
    const len = untils.length;
    for (let j = len - 1; j > 0; j--) {
      if (untils[j] <= utc) {
        return m.metazoneids[offsets[j]];
      }
    }

    // Hit the end, return the initial metazone id
    return m.metazoneids[offsets[0]];
  }

  // This zone has no metazoneid, e.g. "Etc/GMT+1"
  return undefined;
};

const getStableId = (m: Metazones, zoneid: string): string => m.stableids.get(zoneid) || zoneid;

// Built lazily on first use.
let _metazones: Metazones | undefined;

const getMetazones = (): Metazones => _metazones || (_metazones = buildMetazones(metazoneData));

const zoneAlias = /*#__PURE__*/ stringToObject(zoneAliasRaw, '|', ':');

/**
 * Hand-built list of extra timezone aliases, for remapping timezone identifiers
 * that currently do not map 1:1 with a CLDR identifier or aliass.
 * reated using backward mapping in tz database v2017b.
 *
 * TODO: revisit to translate tz database aliases automatically and merge with
 * cldr aliases.
 */
export const timeZoneAliases: { [x: string]: string } = {
  // Import generated zone aliases from CLDR
  ...zoneAlias,

  'Canada/East-Saskatchewan': 'America/Regina',
  'Etc/Unknown': 'Factory',
};
