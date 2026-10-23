import { describe, expect, it } from 'vitest';
import { buildCmip7EsmvalcoreCode, getUnmappedCmip7Filters, isCmip7Datastore } from '../cmip7EsmvalcoreCode';

describe('CMIP7 ESMValCore quick start', () => {
  it('is available for the two CMIP7 collections only', () => {
    expect(isCmip7Datastore('cmip7_australian')).toBe(true);
    expect(isCmip7Datastore('cmip7_replicated')).toBe(true);
    expect(isCmip7Datastore('cmip7_replicas')).toBe(false);
    expect(isCmip7Datastore('cmip6')).toBe(false);
  });

  it('translates selected catalogue fields to ESMValCore CMIP7 facets', () => {
    const code = buildCmip7EsmvalcoreCode({
      variable_id: ['tas', 'pr'],
      source_id: ['ACCESS-ESM1-6'],
      experiment_id: ['historical'],
      variant_label: ['r1i1p1f1'],
      grid_label: ['g115'],
      frequency: ['mon'],
    });

    expect(code).toContain('project="CMIP7"');
    expect(code).toContain('short_name=["tas","pr"],  # variable_id');
    expect(code).toContain('dataset="ACCESS-ESM1-6",  # source_id');
    expect(code).toContain('exp="historical",  # experiment_id');
    expect(code).toContain('ensemble="r1i1p1f1",  # variant_label');
    expect(code).toContain('grid="g115",  # grid_label');
    expect(code).toContain('frequency="mon",  # frequency');
    expect(code).toContain('drs_specs="*",');
    expect(code).toContain('branding_suffix="*",');
    expect(code).toContain('matches = list(islice(query.from_files(), 5))');
    expect(code).toContain('cube = matches[0].load()');
  });

  it('uses wildcard facets where no filter is selected and safely quotes selected values', () => {
    const code = buildCmip7EsmvalcoreCode({ source_id: ['ACCESS "ESM" \\test'] });

    expect(code).toContain('short_name="*",  # variable_id');
    expect(code).toContain('dataset="ACCESS \\"ESM\\" \\\\test",  # source_id');
  });

  it('identifies selected catalogue filters that cannot be translated', () => {
    expect(
      getUnmappedCmip7Filters({
        variable_id: ['tas'],
        branded_variable: ['tas'],
        project: ['xp65'],
        product: [],
      }),
    ).toEqual(['branded_variable', 'project']);
  });
});
