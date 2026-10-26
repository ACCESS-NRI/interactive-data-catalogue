import { describe, expect, it } from 'vitest';
import { load as loadYaml } from 'js-yaml';
import { buildCmipEsmvaltoolRecipe } from '../cmipEsmvaltoolRecipe';

describe('CMIP ESMValTool recipe starter', () => {
  it('uses CMIP7 catalogue selections and resolves branded variables', () => {
    const recipe = buildCmipEsmvaltoolRecipe(
      {
        source_id: ['ACCESS-ESM1-6'],
        experiment_id: ['historical'],
        variant_label: ['r1i1p1f1'],
        grid_label: ['g115'],
        frequency: ['mon'],
        realm: ['atmos'],
        variable_id: ['tas'],
        branded_variable: ['tas_tavg-h2m-hxy-u'],
      },
      'CMIP7',
    );

    expect(recipe.missingSelections).toEqual([]);
    expect(recipe.ignoredFilters).toEqual([]);
    expect(recipe.yaml).toContain('project: "CMIP7"');
    expect(recipe.yaml).toContain('dataset: "ACCESS-ESM1-6"');
    expect(recipe.yaml).toContain('exp: "historical"');
    expect(recipe.yaml).toContain('ensemble: "r1i1p1f1"');
    expect(recipe.yaml).toContain('grid: "g115"');
    expect(recipe.yaml).toContain('frequency: "mon"');
    expect(recipe.yaml).toContain('"tas_tavg-h2m-hxy-u":');
    expect(recipe.yaml).toContain('short_name: "tas"');
    expect(recipe.yaml).toContain('mip: "atmos"');
    expect(recipe.yaml).toContain('branding_suffix: "tavg-h2m-hxy-u"');
    expect(recipe.yaml).toContain('scripts: null');
    expect(recipe.yaml).toContain('esmvaltool run --remove_preproc_dir=False recipe_catalogue.yml');
    expect(loadYaml(recipe.yaml)).toMatchObject({
      datasets: [{ project: 'CMIP7', dataset: 'ACCESS-ESM1-6', exp: 'historical', frequency: 'mon' }],
      diagnostics: {
        catalogue_selection: {
          variables: {
            'tas_tavg-h2m-hxy-u': { short_name: 'tas', mip: 'atmos', branding_suffix: 'tavg-h2m-hxy-u' },
          },
          scripts: null,
        },
      },
    });
  });

  it('uses the CMIP6 table as mip and includes each selected source and variable', () => {
    const recipe = buildCmipEsmvaltoolRecipe(
      {
        source_id: ['ACCESS-ESM1-5', 'ACCESS-CM2'],
        experiment_id: ['historical', 'ssp585'],
        member_id: ['r1i1p1f1'],
        table_id: ['Amon'],
        variable_id: ['tas', 'pr'],
      },
      'CMIP6',
    );

    expect(recipe.missingSelections).toEqual([]);
    expect(recipe.ignoredFilters).toEqual([]);
    expect(recipe.yaml.match(/  - project: "CMIP6"/g)).toHaveLength(2);
    expect(recipe.yaml).toContain('dataset: "ACCESS-ESM1-5"');
    expect(recipe.yaml).toContain('dataset: "ACCESS-CM2"');
    expect(recipe.yaml).toContain('exp: ["historical","ssp585"]');
    expect(recipe.yaml).toContain('ensemble: "r1i1p1f1"');
    expect(recipe.yaml).toContain('"tas":');
    expect(recipe.yaml).toContain('"pr":');
    expect(recipe.yaml).toContain('mip: "Amon"');
    expect(recipe.yaml).not.toContain('branding_suffix:');
  });

  it('marks required recipe fields instead of inventing CMIP7 values', () => {
    const recipe = buildCmipEsmvaltoolRecipe({}, 'CMIP7');

    expect(recipe.missingSelections).toEqual(['one Realm', 'Variable Id', 'Branded Variable']);
    expect(recipe.yaml).toContain('dataset: "*"');
    expect(recipe.yaml).toContain('dataset "*" searches all available models');
    expect(recipe.yaml).toContain('"REPLACE_WITH_VARIABLE_ID":');
    expect(recipe.yaml).toContain('mip: "REPLACE_WITH_ONE_REALM"');
    expect(recipe.yaml).toContain('branding_suffix: "REPLACE_WITH_BRANDING_SUFFIX"');
  });

  it('quotes filter values so special characters remain YAML strings', () => {
    const recipe = buildCmipEsmvaltoolRecipe(
      { source_id: ['a: b "quoted"'], variable_id: ['tas'], table_id: ['Amon'] },
      'CMIP6',
    );

    expect(recipe.yaml).toContain('dataset: "a: b \\"quoted\\""');
  });

  it('reports selected filters that cannot be represented in the recipe', () => {
    const recipe = buildCmipEsmvaltoolRecipe(
      { variable_id: ['tas'], table_id: ['Amon'], product: ['model-output'], region: ['glb'] },
      'CMIP6',
    );

    expect(recipe.ignoredFilters).toEqual(['product', 'region']);
    expect(recipe.yaml).not.toContain('product:');
    expect(recipe.yaml).not.toContain('region:');
  });
});
