import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { load } from 'js-yaml';
import {
  buildCmipIntakeCode,
  buildCmipCollectionCoreCode,
  buildCmipCollectionRecipe,
  cmipStorageProjects,
} from '../cmipAccessCode';

// Execute generated Python with small API doubles: verifies syntax and actual
// multi-collection iteration without requiring Gadi or opening remote files.
function runPython(code: string, prelude = '', checks = '') {
  const result = spawnSync('python3', ['-c', `${prelude}\n${code}\n${checks}`], { encoding: 'utf8' });
  expect(result.stderr, result.stdout).toBe('');
  expect(result.status).toBe(0);
}
const intakePrelude = `
import sys, types
from types import SimpleNamespace
class Catalogue:
    def __init__(self, name):
        self.name = name
        self.df = SimpleNamespace(columns=["source_id", "variable_id"])
    def search(self, **filters):
        assert filters == {"source_id": [r"^ACCESS\\.CM2$"], "variable_id": ["^tas$"]}, filters
        self.df = [1]
        return self
    def to_dataset_dict(self):
        return {"same-key": self.name}
sys.modules["intake"] = SimpleNamespace(cat=SimpleNamespace(access_nri={
    name: Catalogue(name) for name in ["cmip6_fs38", "cmip6_oi10", "cmip7_australian", "cmip7_replicated"]
}))
sys.modules["dask"] = types.ModuleType("dask")
sys.modules["dask.distributed"] = SimpleNamespace(Client=lambda **kwargs: None)
`;
const corePrelude = `
import sys, types
from types import SimpleNamespace
queries = []
CFG = {"projects": {"CMIP6": {}, "CMIP7": {}}}
class Dataset:
    def __init__(self, **facets):
        assert all(isinstance(value, str) for value in facets.values()), facets
        self.facets = facets
        queries.append(facets)
    def from_files(self):
        return [self]
    def load(self):
        return self.facets
sys.modules["esmvalcore"] = types.ModuleType("esmvalcore")
sys.modules["esmvalcore.config"] = SimpleNamespace(CFG=CFG)
sys.modules["esmvalcore.dataset"] = SimpleNamespace(Dataset=Dataset)
`;

describe('access code across CMIP collections', () => {
  it.each(['CMIP6', 'CMIP7'] as const)(
    'loads both %s intake collections without overwriting equal dataset keys',
    (project) => {
      runPython(
        buildCmipIntakeCode({ source_id: ['ACCESS.CM2'], variable_id: ['tas'] }, project),
        intakePrelude,
        'assert len(dataset_dict) == 2\nassert len(set(dataset_dict.values())) == 2',
      );
    },
  );

  it('refuses to silently ignore an unsupported Intake filter', () => {
    const code = buildCmipIntakeCode({ unknown: ['value'] }, 'CMIP6');
    runPython(
      `try:\n${code
        .split('\n')
        .map((line) => `    ${line}`)
        .join(
          '\n',
        )}\nexcept ValueError as error:\n    assert "unknown" in str(error)\nelse:\n    raise AssertionError("The filter was ignored")`,
      intakePrelude,
    );
  });

  it('uses scalar combinations for CMIP6 and loads every returned dataset', () => {
    runPython(
      buildCmipCollectionCoreCode(
        {
          source_id: ['ACCESS-CM2', 'ACCESS-ESM1-5'],
          experiment_id: ['historical', 'ssp585'],
          member_id: ['r1i1p1f1', 'r2i1p1f1'],
          project_id: ['CMIP'],
          table_id: ['Amon'],
          variable_id: ['tas'],
        },
        'CMIP6',
      ),
      corePrelude,
      `
assert len(queries) == len(cubes) == 8
assert all(query["activity"] == "CMIP" and query["mip"] == "Amon" for query in queries)
assert CFG["search_data"] == "complete"
assert {source["rootpath"] for source in CFG["projects"]["CMIP6"]["data"].values()} == {"/g/data/fs38/publications", "/g/data/oi10/replicas"}
`,
    );
  });

  it('preserves CMIP7 variable-brand pairs rather than generating unselected combinations', () => {
    runPython(
      buildCmipCollectionCoreCode(
        {
          branded_variable: ['tas_tavg-h2m-hxy-u', 'pr_tavg-u-hxy-u'],
          source_id: ['ACCESS-ESM1-6'],
        },
        'CMIP7',
      ),
      corePrelude,
      `
assert len(queries) == len(cubes) == 2
assert {(query["short_name"], query["branding_suffix"]) for query in queries} == {("tas", "tavg-h2m-hxy-u"), ("pr", "tavg-u-hxy-u")}
assert {source["rootpath"] for source in CFG["projects"]["CMIP7"]["data"].values()} == {"/g/data/im55/publications", "/g/data/ib12/replicas"}
`,
    );
  });

  it('fails before ESMValCore searches when a selected filter cannot be represented', () => {
    const code = buildCmipCollectionCoreCode({ version: ['v20200101'] }, 'CMIP6');
    runPython(
      `try:\n${code
        .split('\n')
        .map((line) => `    ${line}`)
        .join(
          '\n',
        )}\nexcept ValueError as error:\n    assert "version" in str(error)\nelse:\n    raise AssertionError("The filter was ignored")`,
      corePrelude,
      'assert queries == []',
    );
  });

  it('creates a recipe with scalar model/experiment/member combinations and both data sources', () => {
    const result = buildCmipCollectionRecipe(
      {
        source_id: ['ACCESS-CM2', 'ACCESS-ESM1-5'],
        experiment_id: ['historical', 'ssp585'],
        member_id: ['r1i1p1f1', 'r2i1p1f1'],
        variable_id: ['tas'],
        table_id: ['Amon'],
        project_id: ['CMIP'],
      },
      'CMIP6',
    );
    const recipe = load(result.yaml) as { datasets: Record<string, unknown>[] };
    expect(recipe.datasets).toHaveLength(8);
    expect(recipe.datasets.every((dataset) => Object.values(dataset).every((value) => typeof value === 'string'))).toBe(
      true,
    );
    expect(recipe.datasets[0]).toMatchObject({ activity: 'CMIP', timerange: '*', grid: '*' });
    expect(load(result.config)).toMatchObject({
      search_data: 'complete',
      projects: {
        CMIP6: {
          data: {
            cmip6_fs38: { rootpath: '/g/data/fs38/publications' },
            cmip6_oi10: { rootpath: '/g/data/oi10/replicas' },
          },
        },
      },
    });
    expect(result.command).toContain('--config_dir ./cmip-config');
    expect(result.missingSelections).toEqual([]);
    expect(result.ignoredFilters).toEqual([]);
  });

  it('keeps recipe requirements and unsupported-filter warnings visible', () => {
    const recipe = buildCmipCollectionRecipe({ version: ['v20260101'] }, 'CMIP7');
    expect(recipe.missingSelections).toEqual(['one Realm', 'Variable Id', 'Branded Variable']);
    expect(recipe.ignoredFilters).toEqual(['version']);
    expect(recipe.yaml).toContain('REPLACE_WITH_VARIABLE_ID');
    expect(cmipStorageProjects('CMIP6')).toEqual(['xp65', 'fs38', 'oi10']);
    expect(cmipStorageProjects('CMIP7')).toEqual(['xp65', 'im55', 'ib12']);
  });

  it('intersects variable and branded-variable selections and blocks conflicting recipes', () => {
    const recipe = buildCmipCollectionRecipe(
      {
        variable_id: ['tas', 'pr'],
        branded_variable: ['tas_tavg-h2m-hxy-u'],
        realm: ['atmos'],
      },
      'CMIP7',
    );
    expect(recipe.missingSelections).toEqual([]);
    expect(recipe.ignoredFilters).toEqual([]);
    expect(recipe.yaml).toContain('short_name: "tas"');
    expect(recipe.yaml).not.toContain('short_name: "pr"');
    expect(
      buildCmipCollectionRecipe({ variable_id: ['pr'], branded_variable: ['tas_tavg-h2m-hxy-u'] }, 'CMIP7')
        .ignoredFilters,
    ).toContain('branded_variable');
  });
});
