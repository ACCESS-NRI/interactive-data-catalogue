import { describe, expect, it } from 'vitest';
import { buildCmipEsmvalcoreCode, getCmipProject, getUnmappedCmipFilters } from '../cmipEsmvalcoreCode';

describe('CMIP ESMValCore quick start', () => {
  it('is available for the four supported CMIP collections only', () => {
    expect(getCmipProject('cmip6_fs38')).toBe('CMIP6');
    expect(getCmipProject('cmip6_oi10')).toBe('CMIP6');
    expect(getCmipProject('cmip7_australian')).toBe('CMIP7');
    expect(getCmipProject('cmip7_replicated')).toBe('CMIP7');
    expect(getCmipProject('cmip7_replicas')).toBeNull();
    expect(getCmipProject('era5')).toBeNull();
  });

  it('translates selected catalogue fields to ESMValCore CMIP7 facets', () => {
    const code = buildCmipEsmvalcoreCode(
      {
        variable_id: ['tas', 'pr'],
        source_id: ['ACCESS-ESM1-6'],
        experiment_id: ['historical'],
        variant_label: ['r1i1p1f1'],
        grid_label: ['g115'],
        frequency: ['mon'],
      },
      'CMIP7',
    );

    expect(code).toContain('project="CMIP7"');
    expect(code).toMatch(
      /^"""\nYou will need to run this in an ARE session on Gadi: https:\/\/are\.nci\.org\.au\/pun\/sys\/dashboard\n\nESMValCore calls its search fields "facets"\. Comments beside some fields show\nthe matching catalogue filter \(for example, short_name maps to variable_id\)\.\n\nA search may find many datasets\. Add more catalogue filters, or replace '\*'\nvalues below, until only the dataset you want matches\.\n"""\n\nfrom itertools import islice/,
    );
    expect(code).toContain('short_name=["tas","pr"],  # variable_id');
    expect(code).toContain('dataset="ACCESS-ESM1-6",  # source_id');
    expect(code).toContain('exp="historical",  # experiment_id');
    expect(code).toContain('ensemble="r1i1p1f1",  # variant_label');
    expect(code).toContain('grid="g115",  # grid_label');
    expect(code).toContain('frequency="mon",  # frequency');
    expect(code).toContain('drs_specs="*",');
    expect(code).toContain('branding_suffix="*",');
    expect(code).toContain('matches = list(islice(query.from_files(), 5))');
    expect(code).toContain('if len(matches) > 1:');
    expect(code).toContain(
      'raise ValueError("Multiple local CMIP7 datasets matched; make the search above more specific")',
    );
    expect(code).toContain('cube = matches[0].load()');
  });

  it('translates CMIP6 member and table columns to ESMValCore facets', () => {
    const code = buildCmipEsmvalcoreCode(
      {
        variable_id: ['tas'],
        source_id: ['ACCESS-ESM1-5'],
        experiment_id: ['historical'],
        member_id: ['r1i1p1f1'],
        table_id: ['Amon'],
        grid_label: ['gn'],
      },
      'CMIP6',
    );

    expect(code).toContain('project="CMIP6"');
    expect(code.startsWith('"""\nYou will need to run this in an ARE session on Gadi:')).toBe(true);
    expect(code).toContain('short_name="tas",  # variable_id');
    expect(code).toContain('dataset="ACCESS-ESM1-5",  # source_id');
    expect(code).toContain('ensemble="r1i1p1f1",  # member_id');
    expect(code).toContain('mip="Amon",  # table_id');
    expect(code).toContain('grid="gn",  # grid_label');
    expect(code).toContain('cube = matches[0].load()');
  });

  it('uses wildcard facets where no filter is selected and safely quotes selected values', () => {
    const code = buildCmipEsmvalcoreCode({ source_id: ['ACCESS "ESM" \\test'] }, 'CMIP7');

    expect(code).toContain('short_name="*",  # variable_id');
    expect(code).toContain('dataset="ACCESS \\"ESM\\" \\\\test",  # source_id');
  });

  it('identifies selected catalogue filters that cannot be translated', () => {
    expect(
      getUnmappedCmipFilters(
        {
          variable_id: ['tas'],
          branded_variable: ['tas'],
          project: ['xp65'],
          product: [],
        },
        'CMIP7',
      ),
    ).toEqual(['branded_variable', 'project']);

    expect(
      getUnmappedCmipFilters({ member_id: ['r1i1p1f1'], table_id: ['Amon'], time_range: ['185001-201412'] }, 'CMIP6'),
    ).toEqual(['time_range']);
  });
});
