import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import {
  aggregateCmipDatasets,
  indexCmipDatasets,
  buildCmipDatasetQuery,
  selectCmipFiles,
  exportCmipFiles,
  type CmipQuerySource,
} from '../cmipDatasetQuery';
import type { FilterMap } from '../../types/datastore';

const require = createRequire(import.meta.url);
const duckdb = require('@duckdb/duckdb-wasm/dist/duckdb-node-blocking.cjs');
let conn: any;
const root = '/g/data/im55/publications/MIP-DRS7/';
const drs = 'CMIP7/C4MIP/ACCESS-Consortium/ACCESS-ESM1-6/1pctCO2-rad/r1i1p1f1/glb/day/tas/tavg-h2m-hxy-u/g115';
const filename = (time: string) => `tas_day_ACCESS_1pctCO2-rad_${time}.nc`;
const path = (time: string, version = 'v20261019', dataset = drs) => `${root}${dataset}/${version}/${filename(time)}`;
const types = new Map([
  ['path', 'VARCHAR'],
  ['source_id', 'VARCHAR'],
  ['start_time', 'DOUBLE'],
  ['variable', 'VARCHAR[]'],
]);
const sources: CmipQuerySource[] = [0, 1].map((n) => ({
  name: `source${n}`,
  table: `files${n}`,
  pathColumn: 'path',
  types,
}));
function insert(p: string, source = 0, start = 2900101, model = 'ACCESS-ESM1-6') {
  const statement = conn.prepare(`INSERT INTO files${source} VALUES (?, ?, ?, ['tas'])`);
  statement.query(p, model, start);
  statement.close();
}
function run(sql: string, parameters: (string | number)[] = []) {
  const statement = conn.prepare(sql);
  try {
    return statement.query(...parameters).toArray();
  } finally {
    statement.close();
  }
}
function groups(filters: FilterMap = {}, project: 'CMIP6' | 'CMIP7' = 'CMIP7', limit = 100, offset = 0) {
  const { cte, parameters } = buildCmipDatasetQuery(project, sources, filters);
  return run(`${cte} ${aggregateCmipDatasets} ORDER BY dataset_key LIMIT ? OFFSET ?`, [...parameters, limit, offset]);
}
function files(key: string, limit = 100, offset = 0) {
  const { cte, parameters } = buildCmipDatasetQuery('CMIP7', sources, {});
  return run(`${cte} ${selectCmipFiles}`, [...parameters, key, limit, offset]).map((r: any) => r.file_path);
}
beforeAll(async () => {
  const db = await duckdb.createDuckDB(
    {
      mvp: { mainModule: require.resolve('@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm') },
      eh: { mainModule: require.resolve('@duckdb/duckdb-wasm/dist/duckdb-eh.wasm') },
    },
    new duckdb.VoidLogger(),
    duckdb.NODE_RUNTIME,
  );
  await db.instantiate();
  conn = db.connect();
});
afterAll(() => conn?.close());
beforeEach(() => {
  for (const n of [0, 1])
    conn.query(
      `CREATE OR REPLACE TABLE files${n} (path VARCHAR, source_id VARCHAR, start_time DOUBLE, variable VARCHAR[])`,
    );
});

describe('CMIP aggregation in the real DuckDB WASM engine', () => {
  it('exports every filtered file across dataset ranges, without display-page limits or alternate paths', () => {
    const expected: string[] = [];
    for (let model = 0; model < 25; model++) {
      const identity = drs.replace('ACCESS-ESM1-6', `Model${String(model).padStart(2, '0')}`);
      for (let year = 2000; year < 2012; year++) {
        const time = `${year}0101-${year}1231`;
        const versioned = path(time, 'v20261019', identity);
        insert(versioned);
        insert(path(time, 'files/d20261019', identity));
        insert(versioned, 1);
        expected.push(versioned);
      }
    }
    const anotherVersion = path('20000101-20001231', 'v20261020');
    insert(anotherVersion);
    expected.push(anotherVersion);
    insert(path('20000101-20001231', 'v20261021'), 0, 2900101, 'ExcludedModel');
    const { cte, parameters } = buildCmipDatasetQuery('CMIP7', sources, { source_id: ['ACCESS-ESM1-6'] });
    const identities = run(`${cte} ${indexCmipDatasets} ORDER BY dataset_key`, parameters).map(
      (r: any) => r.dataset_key,
    );
    const all: string[] = [];
    for (let index = 0; index < identities.length; index += 10) {
      const range = identities.slice(index, index + 10);
      all.push(
        ...run(`${cte} ${exportCmipFiles}`, [...parameters, range[0], range[range.length - 1]]).map(
          (r: any) => r.file_path,
        ),
      );
    }
    expect(all).toHaveLength(301);
    expect(new Set(all)).toEqual(new Set(expected));
    expect(all.every((p) => !p.includes('/files/'))).toBe(true);
    const selected = run(`${cte} ${exportCmipFiles}`, [...parameters, identities[1], identities[1]]);
    expect(selected).toHaveLength(12);
  });

  it('groups all time chunks and replicas before dataset and file pagination, preferring listed version paths', () => {
    for (const time of ['02850101-02891231', '02900101-02941231', '02950101-02991231']) {
      insert(path(time, 'files/d20261019'));
      insert(path(time));
      insert(path(time).replace(root, '/g/data/ib12/replicas/MIP-DRS7/'), 1);
    }
    const { cte, parameters } = buildCmipDatasetQuery('CMIP7', sources, {});
    run(`CREATE OR REPLACE TEMP TABLE dataset_index AS ${cte} ${indexCmipDatasets}`, parameters);
    expect(Number(run('SELECT COUNT(*) AS n FROM dataset_index')[0].n)).toBe(1);
    const key = run('SELECT dataset_key FROM dataset_index ORDER BY dataset_key LIMIT 1')[0].dataset_key;
    const pageQuery = aggregateCmipDatasets.replace(
      'FROM matching GROUP BY',
      'FROM matching WHERE dataset_key IN (?) GROUP BY',
    );
    expect(Number(run(`${cte} ${pageQuery}`, [...parameters, key])[0].file_count)).toBe(3);
    const result = groups({}, 'CMIP7', 1);
    expect(result).toHaveLength(1);
    expect(Number(result[0].file_count)).toBe(3);
    expect(Number(result[0].path_count)).toBe(9);
    expect(Array.from(result[0].collections)).toEqual(['source0', 'source1']);
    expect(result[0].time_start).toBe('02850101');
    expect(result[0].time_end).toBe('02991231');
    expect(groups({}, 'CMIP7', 1, 1)).toHaveLength(0);
    const first = files(result[0].dataset_key, 2);
    const last = files(result[0].dataset_key, 2, 2);
    expect([...first, ...last]).toHaveLength(3);
    expect(new Set([...first, ...last]).size).toBe(3);
    expect([...first, ...last].every((p) => p.includes('/v20261019/'))).toBe(true);
    expect(first[0]).toBe(path('02850101-02891231').replace(root, '/g/data/ib12/replicas/MIP-DRS7/'));
  });

  it('keeps different versions, members, grids, variables, and models separate even with identical basenames', () => {
    const time = '02900101-02941231';
    const paths = [
      path(time),
      path(time, 'v20261020'),
      path(time, 'v20261019', drs.replace('r1i1p1f1', 'r2i1p1f1')),
      path(time, 'v20261019', drs.replace('g115', 'g116')),
      path(time, 'v20261019', drs.replace('/tas/', '/pr/')),
      path(time, 'v20261019', drs.replace('ACCESS-ESM1-6', 'OtherModel')),
    ];
    paths.forEach((p) => insert(p));
    expect(groups()).toHaveLength(6);
    expect(groups().map((r: any) => Number(r.file_count))).toEqual([1, 1, 1, 1, 1, 1]);
    expect(groups({}, 'CMIP7', 2, 2).map((r: any) => r.dataset_key)).toEqual(
      groups()
        .slice(2, 4)
        .map((r: any) => r.dataset_key),
    );
  });

  it('keeps a files/d path when there is no matching listed v path and never merges dates', () => {
    insert(path('02900101-02941231', 'files/d20261019'));
    insert(path('02900101-02941231', 'v20261020'));
    const result = groups();
    expect(result).toHaveLength(2);
    expect(files(result[0].dataset_key)).toEqual([path('02900101-02941231', 'files/d20261019')]);
  });

  it('retains unrecognised paths independently instead of guessing an identity', () => {
    insert('/custom/a/tas.nc');
    insert('/custom/b/tas.nc');
    expect(groups()).toHaveLength(2);
    expect(groups().every((r: any) => r.dataset_key.startsWith('unverified:'))).toBe(true);
  });

  it('aggregates undated latest paths but keeps them separate from dated versions', () => {
    for (const time of ['02900101-02941231', '02950101-02991231']) {
      insert(path(time, 'latest'));
      insert(path(time, 'v20261019'));
    }
    const result = groups();
    expect(result).toHaveLength(2);
    expect(result.map((row: any) => Number(row.file_count))).toEqual([2, 2]);
    expect(result[0].dataset_key).toBe(`${drs}/latest`);
    expect(files(result[0].dataset_key).every((p: string) => p.includes('/latest/'))).toBe(true);
    expect(groups({ version: ['v20261019'] })).toHaveLength(1);
  });

  it('applies filters before grouping, including bound values and normalized version dates', () => {
    insert(path('02900101-02941231'), 0, 2900101);
    insert(path('02950101-02991231'), 0, 2950101);
    insert(path('02900101-02941231', 'v20261020'), 0, 2900101);
    expect(Number(groups({ start_time: ['2900101'], version: ['d20261019'], variable: ['tas'] })[0].file_count)).toBe(
      1,
    );
    expect(groups({ source_id: ["x' OR 1=1 --"] })).toHaveLength(0);
    expect(() => groups({ missing: ['tas'] })).toThrow('selected filter: missing');
  });

  it('uses the CMIP6 DRS identity and retains fixed fields without inventing dates', () => {
    const cmip6 = '/g/data/fs38/publications/CMIP6/CMIP/CSIRO/ACCESS-ESM1-5/historical/r1i1p1f1/fx/orog/gn';
    insert(`${cmip6}/files/d20200101/orog_fx_ACCESS_historical_r1i1p1f1_gn.nc`);
    insert(`${cmip6}/v20200101/orog_fx_ACCESS_historical_r1i1p1f1_gn.nc`);
    const result = groups({}, 'CMIP6');
    expect(result).toHaveLength(1);
    expect(Number(result[0].file_count)).toBe(1);
    expect(result[0].time_start).toBeNull();
    expect(result[0].time_end).toBeNull();
  });
});
