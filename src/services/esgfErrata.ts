import { fetchEsgfJson, type EsgfDataset } from './esgfSearch';

const endpoint = import.meta.env.VITE_ESGF_ERRATA_URL || 'https://errata.esgf.io/1/resolve/simple-pid';
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
export async function checkEsgfErrata(
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
