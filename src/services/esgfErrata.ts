import { fetchEsgfJson, type EsgfDataset } from './esgfSearch';

const endpoint = import.meta.env.VITE_ESGF_ERRATA_URL || 'https://errata.esgf.io/1/resolve/simple-pid';
const catalogueEndpoint = import.meta.env.VITE_ESGF_ERRATA_CATALOGUE_URL || 'https://errata.esgf.io/2/';
export type ErrataRequestCache = Map<string, Promise<unknown>>;
export interface EsgfErrata {
  status: 'checking' | 'reported' | 'none' | 'unknown';
  issueUrls: string[];
}

const unknown = (): EsgfErrata => ({ status: 'unknown', issueUrls: [] });
const object = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

function issueUrls(value: unknown): string[] {
  // The API returns either an array or a Python-style list string. Extract only
  // UUIDs; never evaluate the string or use an API-supplied URL as a link.
  const ids = (Array.isArray(value) ? value : [value]).flatMap((entry) =>
    typeof entry === 'string' ? entry.match(/\b[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}\b/gi) || [] : [],
  );
  return [...new Set(ids.map((id) => id.toLowerCase()))].map(
    (id) => `https://errata.esgf.io/static/view.html?uid=${id}`,
  );
}

/** Check only the displayed version, without inheriting errata from its history. */
async function resolvePidErrata(
  dataset: Pick<EsgfDataset, 'id' | 'version'>,
  signal: AbortSignal,
): Promise<EsgfErrata> {
  const match = /^([\w.-]+)\.v(\d{8})$/.exec(dataset.id);
  if (!match || (dataset.version && dataset.version.replace(/^v/, '') !== match[2])) return unknown();
  try {
    const url = new URL(endpoint, window.location.origin);
    url.searchParams.set('datasets', dataset.id);
    const response = object(await fetchEsgfJson(url.toString(), signal));
    // Responses are keyed by PID, not dataset ID. Only accept the exact DRS and
    // version requested: a missing PID or HTTP 500 is not evidence of no errata.
    const entries = Object.values(response)
      .map(object)
      .filter((entry) => entry.drs === match[1] && String(entry.version).replace(/^v/, '') === match[2]);
    const reported = entries.filter((entry) => entry.success === true && entry.has_errata === true);
    if (reported.length) {
      return { status: 'reported', issueUrls: [...new Set(reported.flatMap((entry) => issueUrls(entry.errata_ids)))] };
    }
    if (
      entries.length &&
      entries.every(
        (entry) => entry.success === true && entry.has_errata === false && issueUrls(entry.errata_ids).length === 0,
      )
    ) {
      return { status: 'none', issueUrls: [] };
    }
    return unknown();
  } catch {
    // Errata outages must not hide search results or imply an unaffected dataset.
    return unknown();
  }
}

async function cachedJson(url: URL, signal: AbortSignal, cache: ErrataRequestCache): Promise<unknown> {
  const key = url.toString();
  let pending = cache.get(key);
  if (!pending) {
    pending = fetchEsgfJson(key, signal);
    if (cache.size >= 200) cache.delete(cache.keys().next().value!);
    cache.set(key, pending);
  }
  try {
    return await pending;
  } catch (cause) {
    if (cache.get(key) === pending) cache.delete(key);
    throw cause;
  }
}

/** PID records can omit published errata. Check the issue catalogue before
 * accepting a negative, matching its affected dataset list to the exact version. */
export async function checkEsgfErrata(
  dataset: Pick<EsgfDataset, 'id' | 'version'>,
  signal: AbortSignal,
  cache: ErrataRequestCache = new Map(),
): Promise<EsgfErrata> {
  const match = /^([\w.-]+)\.v(\d{8})$/.exec(dataset.id);
  if (!match || (dataset.version && dataset.version.replace(/^v/, '') !== match[2])) return unknown();
  const pid = await resolvePidErrata(dataset, signal);
  if (pid.status === 'reported' || signal.aborted) return pid;
  const parts = match[1]!.replace(/^MIP-DRS7\./, '').split('.');
  if (!['CMIP6', 'CMIP7'].includes(parts[0]!) || parts.length < 9) return unknown();
  try {
    const base = new URL(catalogueEndpoint.replace(/\/?$/, '/'), window.location.origin);
    const url = new URL('search/errata', base);
    url.searchParams.set('project', parts[0]!.toLowerCase());
    url.searchParams.set('source_id', parts[3]!.toLowerCase());
    url.searchParams.set('experiment_id', parts[4]!.toLowerCase());
    if (parts[0] === 'CMIP6') url.searchParams.set('table_id', parts[6]!.toLowerCase());
    // Do not filter on variable_id: published issues may omit that facet even
    // when their affected dataset lists explicitly contain the variable.
    const search = object(await cachedJson(url, signal, cache));
    if (!Array.isArray(search.results) || search.count !== search.results.length) return unknown();
    const links: string[] = [];
    let complete = true;
    for (const raw of search.results) {
      if (signal.aborted) return unknown();
      const uid = object(raw).uid;
      if (typeof uid !== 'string' || !/^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i.test(uid)) {
        complete = false;
        continue;
      }
      try {
        const detailUrl = new URL('publication/retrieve', base);
        detailUrl.searchParams.set('uid', uid);
        const issue = object(object(await cachedJson(detailUrl, signal, cache)).issue);
        if (
          issue.uid !== uid ||
          !Array.isArray(issue.datasets) ||
          !issue.datasets.every((id) => typeof id === 'string')
        ) {
          complete = false;
          continue;
        }
        if (issue.datasets.some((id: string) => id.replace(/#(\d{8})$/, '.v$1') === dataset.id)) {
          links.push(...issueUrls(uid));
        }
      } catch {
        complete = false;
      }
    }
    if (links.length) return { status: 'reported', issueUrls: [...new Set(links)] };
    return complete ? pid : unknown();
  } catch {
    return unknown();
  }
}
