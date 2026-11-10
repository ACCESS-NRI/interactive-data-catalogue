import { describe, expect, it } from 'vitest';
import { nciFileAccess } from '../nciFileAccess';

const cmip6 = 'CMIP6/C4MIP/CSIRO/ACCESS-ESM1-5/1pctCO2-bgc/r1i1p1f1/Amon/cl/gn/v20191118';
const filename6 = 'cl_Amon_ACCESS-ESM1-5_1pctCO2-bgc_r1i1p1f1_gn_010101-012012.nc';
const cmip7 =
  'MIP-DRS7/CMIP7/CMIP/ACCESS-Consortium/ACCESS-ESM1-6/piControl/r1i1p1f1/glb/mon/zostoga/tavg-u-hm-sea/g118/v20261002';

describe('NCI file access links', () => {
  it.each([
    ['/g/data/fs38/publications', cmip6, 'master'],
    ['/g/data/oi10/replicas', cmip6, 'replica'],
    ['/g/data/im55/publications', cmip7, 'master'],
    ['/g/data/ib12/replicas', cmip7, 'replica'],
  ])('maps the published THREDDS root for %s', (root, drs, branch) => {
    const links = nciFileAccess(`${root}/${drs}/tas.nc`, 'file')!;
    const url = new URL(links.thredds);
    expect(url.origin).toBe('https://esgf.nci.org.au');
    expect(url.pathname).toBe(`/thredds/catalog/esgcet/${branch}/${drs}/catalog.html`);
    expect(url.searchParams.get('dataset')).toBe(`esgcet/${branch}/${drs}/tas.nc`);
  });

  it.each(['v20191118', 'files/d20191118', 'latest'])('preserves the actual %s path and version', (version) => {
    const drs = cmip6.replace('v20191118', version);
    const links = nciFileAccess(`/g/data/fs38/publications/${drs}/${filename6}`, 'file')!;
    expect(new URL(links.thredds).searchParams.get('dataset')).toBe(`esgcet/master/${drs}/${filename6}`);
    const globus = new URL(links.globus!);
    expect(globus.searchParams.get('origin_id')).toBe('2058c7d6-a79f-11e6-9ad6-22000a1e3b52');
    expect(globus.searchParams.get('origin_path')).toBe(`/master/${drs}/`);
    expect(globus.searchParams.has('destination_id')).toBe(false);
  });

  it('uses the distinct collection and path published in NCI CMIP7 STAC assets', () => {
    const links = nciFileAccess(`/g/data/im55/publications/${cmip7}/`, 'directory')!;
    const globus = new URL(links.globus!);
    expect(globus.searchParams.get('origin_id')).toBe('1c2cce26-f869-4c61-8cbe-7a856324a72b');
    expect(globus.searchParams.get('origin_path')).toBe(`/esgcet/master/${cmip7}/`);
  });

  it('does not invent a Globus mapping for CMIP7 replicas', () => {
    expect(nciFileAccess(`/g/data/ib12/replicas/${cmip7}/`, 'directory')?.globus).toBeUndefined();
  });

  it('opens a directory listing without selecting a file, with or without a trailing slash', () => {
    const path = `/g/data/fs38/publications/${cmip6}`;
    const links = nciFileAccess(path, 'directory')!;
    expect(nciFileAccess(`${path}/`, 'directory')).toEqual(links);
    expect(links.thredds).toBe(`https://esgf.nci.org.au/thredds/catalog/esgcet/master/${cmip6}/catalog.html`);
    expect(new URL(links.globus!).searchParams.get('origin_path')).toBe(`/master/${cmip6}/`);
  });

  it('encodes reserved characters without changing the dataset or adding query parameters', () => {
    const suffix = 'folder name/tas #?&%.nc';
    const links = nciFileAccess(`/g/data/fs38/publications/${cmip6}/${suffix}`, 'file')!;
    const thredds = new URL(links.thredds);
    expect(thredds.pathname).toContain('/folder%20name/catalog.html');
    expect(thredds.searchParams.get('dataset')).toBe(`esgcet/master/${cmip6}/${suffix}`);
    expect([...thredds.searchParams.keys()]).toEqual(['dataset']);
    expect(thredds.hash).toBe('');
    expect(new URL(links.globus!).searchParams.get('origin_path')).toBe(`/master/${cmip6}/folder name/`);
  });

  it.each([
    '',
    '/g/data/private/project/tas.nc',
    '/g/data/fs38/publications/CMIP6-other/tas.nc',
    '/g/data/fs38/unpublished/CMIP6/tas.nc',
    'https://example.com/tas.nc',
    'javascript:alert(1)',
    '/g/data/fs38/publications/CMIP6/../secret.nc',
    '/g/data/fs38/publications/CMIP6/./tas.nc',
    '/g/data/fs38/publications/CMIP6//tas.nc',
    '/g/data/fs38/publications/CMIP6/tas\\name.nc',
    '/g/data/fs38/publications/CMIP6/tas\nname.nc',
    '/g/data/fs38/publications/CMIP6/folder/',
  ])('omits unsupported or ambiguous file paths: %s', (path) => {
    expect(nciFileAccess(path, 'file')).toBeNull();
  });
});
