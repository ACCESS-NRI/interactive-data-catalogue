import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useBuildInfo } from '../useBuildInfo';

describe('useBuildInfo', () => {
  const originalSha = (globalThis as any).__GIT_COMMIT_SHA__;
  const originalTime = (globalThis as any).__BUILD_TIME__;

  afterEach(() => {
    if (originalSha === undefined) {
      delete (globalThis as any).__GIT_COMMIT_SHA__;
    } else {
      (globalThis as any).__GIT_COMMIT_SHA__ = originalSha;
    }
    if (originalTime === undefined) {
      delete (globalThis as any).__BUILD_TIME__;
    } else {
      (globalThis as any).__BUILD_TIME__ = originalTime;
    }
  });

  describe('with a valid commit SHA', () => {
    beforeEach(() => {
      (globalThis as any).__GIT_COMMIT_SHA__ = 'abc123def456';
      (globalThis as any).__BUILD_TIME__ = '2025-12-03T10:00:00Z';
    });

    it('returns the full commitSha', () => {
      expect(useBuildInfo().commitSha).toBe('abc123def456');
    });

    it('returns a 7-character shortCommitSha', () => {
      expect(useBuildInfo().shortCommitSha).toBe('abc123d');
    });

    it('builds the correct commitUrl', () => {
      expect(useBuildInfo().commitUrl).toBe(
        'https://github.com/access-nri/interactive-data-catalogue/commit/abc123def456',
      );
    });

    it('sets hasValidCommit to true', () => {
      expect(useBuildInfo().hasValidCommit).toBe(true);
    });

    it('returns the buildTime', () => {
      expect(useBuildInfo().buildTime).toBe('2025-12-03T10:00:00Z');
    });
  });

  describe('when commitSha is "unknown"', () => {
    beforeEach(() => {
      (globalThis as any).__GIT_COMMIT_SHA__ = 'unknown';
    });

    it('sets hasValidCommit to false', () => {
      expect(useBuildInfo().hasValidCommit).toBe(false);
    });

    it('returns an empty shortCommitSha', () => {
      expect(useBuildInfo().shortCommitSha).toBe('');
    });

    it('returns an empty commitUrl', () => {
      expect(useBuildInfo().commitUrl).toBe('');
    });
  });

  describe('when __GIT_COMMIT_SHA__ is not defined', () => {
    beforeEach(() => {
      delete (globalThis as any).__GIT_COMMIT_SHA__;
    });

    it('sets hasValidCommit to false', () => {
      expect(useBuildInfo().hasValidCommit).toBe(false);
    });

    it('returns null for commitSha', () => {
      expect(useBuildInfo().commitSha).toBeNull();
    });

    it('returns an empty shortCommitSha', () => {
      expect(useBuildInfo().shortCommitSha).toBe('');
    });
  });

  describe('when __BUILD_TIME__ is not defined', () => {
    beforeEach(() => {
      (globalThis as any).__GIT_COMMIT_SHA__ = 'abc123def456';
      delete (globalThis as any).__BUILD_TIME__;
    });

    it('returns null for buildTime', () => {
      expect(useBuildInfo().buildTime).toBeNull();
    });

    it('still returns a valid commit SHA', () => {
      expect(useBuildInfo().hasValidCommit).toBe(true);
    });
  });
});
