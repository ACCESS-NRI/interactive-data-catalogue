import { describe, expect, it } from 'vitest';
import { load as loadYaml } from 'js-yaml';
import { buildObservationPythonExample, buildObservationRecipeExample } from '../esmvalObservationExamples';

describe('observation ESMVal examples', () => {
  it('maps an indexed OBS6 record to a local search and a parseable recipe', () => {
    const filters = {
      project_id: ['OBS6'],
      source_id: ['ERA-Interim'],
      variable_id: ['tdps'],
      experiment_id: ['reanaly'],
      version: ['1'],
      table_id: ['Emon'],
      tier: ['Tier3'],
    };
    const python = buildObservationPythonExample(filters);
    const recipe = buildObservationRecipeExample(filters);

    expect(python.missingSelections).toEqual([]);
    expect(python.ignoredFilters).toEqual([]);
    expect(python.code).toContain('project="OBS6",  # project_id');
    expect(python.code).toContain('dataset="ERA-Interim",  # source_id');
    expect(python.code).toContain('short_name="tdps",  # variable_id');
    expect(python.code).toContain('type="reanaly",  # experiment_id');
    expect(python.code).toContain('version="1",  # version');
    expect(python.code).toContain('mip="Emon",  # table_id');
    expect(python.code).toContain('tier=3,  # tier');
    expect(python.code).toContain('cube = matches[0].load()');
    expect(recipe.missingSelections).toEqual([]);
    expect(recipe.ignoredFilters).toEqual([]);
    expect(loadYaml(recipe.yaml)).toMatchObject({
      datasets: [{ project: 'OBS6', dataset: 'ERA-Interim', type: 'reanaly', version: '1', tier: 3 }],
      diagnostics: {
        observation_selection: {
          variables: { tdps: { short_name: 'tdps', mip: 'Emon' } },
          scripts: null,
        },
      },
    });
  });

  it('asks for a project when none is selected and keeps selected Source and Variable Id values', () => {
    const filters = { source_id: ['CERES-EBAF'], variable_id: ['rsut'] };
    const python = buildObservationPythonExample(filters);
    const recipe = buildObservationRecipeExample(filters);

    expect(python.missingSelections).toEqual(['one Project Id']);
    expect(python.code).toContain('dataset="CERES-EBAF"');
    expect(python.code).toContain('short_name="rsut"');
    expect(recipe.missingSelections).toContain('one Project Id');
    expect(recipe.yaml).toContain('dataset: "CERES-EBAF"');
    expect(recipe.yaml).toContain('"rsut":');
    expect(loadYaml(recipe.yaml)).toBeTruthy();
  });

  it('uses obs4MIPs conventions and identifies selections it cannot translate', () => {
    const filters = {
      project_id: ['obs4MIPs'],
      source_id: ['CALIOP'],
      variable_id: ['cllcalipso'],
      table_id: ['unknown'],
      version: ['CALIPSO-GOCCP-v2.1'],
      time_range: ['200701-202212'],
    };
    const python = buildObservationPythonExample(filters);
    const recipe = buildObservationRecipeExample(filters);

    expect(python.code).toContain('project="obs4MIPs"');
    expect(python.code).not.toContain('type=');
    expect(python.code).toContain('mip="*",  # table_id');
    expect(python.ignoredFilters).toEqual(['table_id', 'version', 'time_range']);
    expect(recipe.missingSelections).toContain('one Table Id (CMOR table)');
    expect(recipe.ignoredFilters).toEqual(['table_id', 'version', 'time_range']);
    expect(loadYaml(recipe.yaml)).toMatchObject({ datasets: [{ project: 'obs4MIPs', tier: 1 }] });
  });
});
