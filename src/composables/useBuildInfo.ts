declare const __GIT_COMMIT_SHA__: string;
declare const __BUILD_TIME__: string;
declare const __APP_VERSION__: string;

const REPO_URL = 'https://github.com/access-nri/interactive-data-catalogue';

export interface BuildInfo {
  commitSha: string | null;
  buildTime: string | null;
  appVersion: string;
  shortCommitSha: string;
  commitUrl: string;
  releaseUrl: string;
  hasValidCommit: boolean;
  isCleanRelease: boolean;
}

export function useBuildInfo(): BuildInfo {
  const commitSha = typeof __GIT_COMMIT_SHA__ !== 'undefined' ? __GIT_COMMIT_SHA__ : null;
  const buildTime = typeof __BUILD_TIME__ !== 'undefined' ? __BUILD_TIME__ : null;
  const appVersion = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev';

  const hasValidCommit = !!commitSha && commitSha !== 'unknown';
  const shortCommitSha = hasValidCommit ? commitSha!.substring(0, 7) : '';
  const commitUrl = hasValidCommit ? `${REPO_URL}/commit/${commitSha}` : '';
  const isCleanRelease = appVersion !== 'dev' && !appVersion.endsWith('.dirty');
  const releaseUrl = isCleanRelease ? `${REPO_URL}/releases/tag/${appVersion}` : '';

  return { commitSha, buildTime, appVersion, shortCommitSha, commitUrl, releaseUrl, hasValidCommit, isCleanRelease };
}
