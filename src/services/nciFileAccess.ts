export type NciPathKind = 'file' | 'directory';

interface PublicRoot {
  local: string;
  remote: string;
  globus?: { collection: string; prefix: string };
}

// NCI's ESGF THREDDS catalogue exposes these publication/replica roots.
// Globus mappings come from published CMIP6 Solr file URLs and CMIP7 STAC assets;
// the two services use different collection IDs and paths. Do not extrapolate
// these mappings to arbitrary /g/data projects or unpublished collections.
const cmip6Globus = { collection: '2058c7d6-a79f-11e6-9ad6-22000a1e3b52', prefix: '' };
const roots: PublicRoot[] = [
  { local: '/g/data/fs38/publications/CMIP6', remote: 'master/CMIP6', globus: cmip6Globus },
  { local: '/g/data/oi10/replicas/CMIP6', remote: 'replica/CMIP6', globus: cmip6Globus },
  {
    local: '/g/data/im55/publications/MIP-DRS7/CMIP7',
    remote: 'master/MIP-DRS7/CMIP7',
    globus: { collection: '1c2cce26-f869-4c61-8cbe-7a856324a72b', prefix: '/esgcet' },
  },
  // THREDDS is published here; a Globus mapping for this replica collection
  // has not been verified. The transfer guide explains how to find one.
  { local: '/g/data/ib12/replicas/MIP-DRS7/CMIP7', remote: 'replica/MIP-DRS7/CMIP7' },
];

export interface NciFileAccess {
  thredds: string;
  globus?: string;
}

/** Preserve the actual catalogue path, including latest and files/dYYYYMMDD.
 * A link identifies the service location, not a live availability check.
 */
export function nciFileAccess(path: string, kind: NciPathKind): NciFileAccess | null {
  // Reject ambiguous paths rather than allowing URL normalization to point at
  // another directory. Ordinary URL-sensitive filename characters are encoded.
  if (/[\u0000-\u001f\u007f\\]/.test(path) || path.includes('//')) return null;
  const normalized = path.replace(/\/$/, '');
  if (normalized.split('/').some((part) => part === '.' || part === '..')) return null;
  const root = roots.find(({ local }) => normalized === local || normalized.startsWith(`${local}/`));
  if (!root || (kind === 'file' && (path.endsWith('/') || !normalized.endsWith('.nc')))) return null;

  const remote = root.remote + normalized.slice(root.local.length);
  const directory = kind === 'directory' ? remote : remote.slice(0, remote.lastIndexOf('/'));
  const encodePath = (value: string) => value.split('/').map(encodeURIComponent).join('/');
  const thredds = new URL(`https://esgf.nci.org.au/thredds/catalog/esgcet/${encodePath(directory)}/catalog.html`);
  if (kind === 'file') thredds.searchParams.set('dataset', `esgcet/${remote}`);
  const links: NciFileAccess = { thredds: thredds.toString() };
  if (root.globus) {
    const globus = new URL('https://app.globus.org/file-manager');
    globus.searchParams.set('origin_id', root.globus.collection);
    globus.searchParams.set('origin_path', `${root.globus.prefix}/${directory}/`);
    links.globus = globus.toString();
  }
  return links;
}
