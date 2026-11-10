import type { FilterMap } from '../types/datastore';
import type { CmipProject } from './cmipEsmvalcoreCode';

export interface CmipQuerySource {
  name: string;
  table: string;
  pathColumn: string;
  types: Map<string, string>;
}

const identifier = (value: string) => `"${value.replace(/"/g, '""')}"`;
const literal = (value: string) => `'${value.replace(/'/g, "''")}'`;

/** Group the complete filtered catalogue by its DRS dataset/version, before pagination.
 * Only recognised dated publication layouts are folded together. Unknown paths retain
 * their full identity; filenames alone must never merge models, members or versions.
 */
export function buildCmipDatasetQuery(project: CmipProject, sources: CmipQuerySource[], filters: FilterMap) {
  const parameters: string[] = [];
  const selects = sources.map((source) => {
    const path = identifier(source.pathColumn);
    if (!source.types.has(source.pathColumn)) throw new Error('This catalogue does not provide file paths.');
    const conditions = [`${path} IS NOT NULL`, `${path} <> ''`];
    for (const [field, values] of Object.entries(filters)) {
      if (!values.length || field === 'version') continue;
      const type = source.types.get(field);
      if (!type) throw new Error(`The source catalogue does not contain the selected filter: ${field}.`);
      const column = identifier(field);
      const placeholders = values.map(() => '?').join(', ');
      conditions.push(
        type.endsWith('[]')
          ? `list_has_any(list_transform(${column}, value -> CAST(value AS VARCHAR)), [${placeholders}])`
          : `${column} IN (${values.map(() => `TRY_CAST(? AS ${type})`).join(', ')})`,
      );
      parameters.push(...values);
    }
    return `SELECT ${path} AS path, ${literal(source.name)} AS collection
      FROM ${source.table} WHERE ${conditions.join(' AND ')}`;
  });
  const segments = project === 'CMIP6' ? 10 : 12;
  const versions = filters.version ?? [];
  parameters.push(...versions.map((value) => value.replace(/^[dv]([0-9]{8})$/, 'v$1')));
  const cte = `WITH sources AS (${selects.join(' UNION ALL ')}),
    relative AS (
      SELECT *, split_part(path, '/${project}/', 2) AS relative_path
      FROM sources
    ), segments AS (
      SELECT *, split_part(relative_path, '/', -1) AS basename,
        split_part(relative_path, '/', -2) AS version_segment,
        len(string_split(relative_path, '/')) AS segment_count
      FROM relative
    ), identified AS (
      SELECT *, (ends_with(basename, '.nc') AND NOT contains(relative_path, '//') AND (
        (segment_count = ${segments} AND (regexp_full_match(version_segment, 'v[0-9]{8}') OR version_segment = 'latest')) OR
        (segment_count = ${segments + 1} AND regexp_full_match(version_segment, 'd[0-9]{8}')
          AND split_part(relative_path, '/', -3) = 'files')
      )) AS recognised,
      left(relative_path, length(relative_path) - length(basename) - length(version_segment) - 2
        - CASE WHEN segment_count = ${segments + 1} THEN 6 ELSE 0 END) AS dataset_path
      FROM segments
    ), normalized AS (
      SELECT path, collection,
        CASE WHEN recognised THEN '${project}/' || dataset_path || '/' ||
          CASE WHEN version_segment = 'latest' THEN 'latest' ELSE 'v' || substring(version_segment, 2) END
          ELSE 'unverified:' || path END AS dataset_key,
        CASE WHEN recognised THEN CASE WHEN version_segment = 'latest' THEN 'latest' ELSE 'v' || substring(version_segment, 2) END ELSE NULL END AS version,
        CASE WHEN recognised THEN basename ELSE path END AS filename
      FROM identified
    ), matching AS (
      SELECT * FROM normalized ${versions.length ? `WHERE version IN (${versions.map(() => '?').join(', ')})` : ''}
    )`;
  return { cte, parameters };
}

export const indexCmipDatasets = 'SELECT DISTINCT dataset_key FROM matching';

export const aggregateCmipDatasets = `SELECT dataset_key,
  COUNT(DISTINCT filename) AS file_count, COUNT(DISTINCT path) AS path_count,
  list(DISTINCT collection ORDER BY collection) AS collections,
  MIN(NULLIF(regexp_extract(filename, '_([0-9]{4,14})(?:-[0-9]{4,14})?[.]nc$', 1), '')) AS time_start,
  MAX(NULLIF(regexp_extract(filename, '_[0-9]{4,14}-([0-9]{4,14})[.]nc$', 1), '')) AS time_end
  FROM matching GROUP BY dataset_key`;

// Prefer a versioned path only when it is actually listed. Do not manufacture a
// vYYYYMMDD path from files/dYYYYMMDD, or fold different dates into one version.
export const selectCmipFiles = `SELECT COALESCE(
    MIN(path) FILTER (WHERE regexp_matches(path, '/v[0-9]{8}/[^/]+[.]nc$')), MIN(path)
  ) AS file_path FROM matching WHERE dataset_key = ?
  GROUP BY filename ORDER BY filename LIMIT ? OFFSET ?`;
