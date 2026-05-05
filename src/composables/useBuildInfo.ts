declare const __GIT_COMMIT_SHA__: string;
declare const __BUILD_TIME__: string;

const REPO_URL = 'https://github.com/access-nri/interactive-data-catalogue';

export interface BuildInfo {
  commitSha: string | null;
  buildTime: string | null;
  shortCommitSha: string;
  commitUrl: string;
  hasValidCommit: boolean;
}

export function useBuildInfo(): BuildInfo {
  const commitSha = typeof __GIT_COMMIT_SHA__ !== 'undefined' ? __GIT_COMMIT_SHA__ : null;
  const buildTime = typeof __BUILD_TIME__ !== 'undefined' ? __BUILD_TIME__ : null;

  const hasValidCommit = !!commitSha && commitSha !== 'unknown';
  const shortCommitSha = hasValidCommit ? commitSha!.substring(0, 7) : '';
  const commitUrl = hasValidCommit ? `${REPO_URL}/commit/${commitSha}` : '';

  return { commitSha, buildTime, shortCommitSha, commitUrl, hasValidCommit };
}
