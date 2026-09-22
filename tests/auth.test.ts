import { afterEach, describe, expect, it } from 'vitest';
import { resolveToken } from '../src/store.js';

const prev = { ...process.env };

afterEach(() => {
  process.env.PICBED_GITHUB_TOKEN = prev.PICBED_GITHUB_TOKEN;
  process.env.GITHUB_TOKEN = prev.GITHUB_TOKEN;
});

describe('token auth (no OAuth)', () => {
  it('prefers PICBED_GITHUB_TOKEN over GITHUB_TOKEN and gh', () => {
    const t = resolveToken(
      {
        PICBED_GITHUB_TOKEN: 'pat',
        GITHUB_TOKEN: 'other',
      } as NodeJS.ProcessEnv,
      () => 'gh-token',
    );
    expect(t).toEqual({ token: 'pat', source: 'env' });
  });

  it('falls back to GITHUB_TOKEN', () => {
    const t = resolveToken({ GITHUB_TOKEN: 'other' } as NodeJS.ProcessEnv, () => 'gh-token');
    expect(t).toEqual({ token: 'other', source: 'env' });
  });

  it('falls back to gh auth token', () => {
    const t = resolveToken({} as NodeJS.ProcessEnv, () => 'gh-token');
    expect(t).toEqual({ token: 'gh-token', source: 'gh' });
  });

  it('returns undefined when nothing is configured', () => {
    expect(resolveToken({} as NodeJS.ProcessEnv, () => undefined)).toBeUndefined();
  });
});
