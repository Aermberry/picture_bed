import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  authorizeUrl,
  requireOAuthClient,
  randomState,
} from '../src/login.js';
import { loadCredentials, resolveToken, saveCredentials, clearCredentials } from '../src/store.js';

const prev = { ...process.env };

afterEach(() => {
  process.env.YIGE_GITHUB_TOKEN = prev.YIGE_GITHUB_TOKEN;
  process.env.GITHUB_TOKEN = prev.GITHUB_TOKEN;
  process.env.YIGE_CONFIG_HOME = prev.YIGE_CONFIG_HOME;
  delete process.env.YIGE_GITHUB_CLIENT_ID;
  delete process.env.YIGE_GITHUB_CLIENT_SECRET;
});

describe('oauth helpers', () => {
  it('builds authorize url with state', () => {
    const url = authorizeUrl({
      clientId: 'cid',
      redirectUri: 'http://127.0.0.1:53682/callback',
      scope: 'repo',
      state: 'abc',
    });
    expect(url).toContain('client_id=cid');
    expect(url).toContain('state=abc');
    expect(url).toContain(encodeURIComponent('http://127.0.0.1:53682/callback'));
  });

  it('randomState is unique-ish', () => {
    expect(randomState()).not.toBe(randomState());
  });

  it('requireOAuthClient throws without env', () => {
    expect(() => requireOAuthClient({} as NodeJS.ProcessEnv)).toThrowError(/CLIENT_ID/);
  });

  it('requireOAuthClient reads env', () => {
    const c = requireOAuthClient({
      YIGE_GITHUB_CLIENT_ID: 'id',
      YIGE_GITHUB_CLIENT_SECRET: 'sec',
      YIGE_GITHUB_SCOPE: 'public_repo',
    } as NodeJS.ProcessEnv);
    expect(c.clientId).toBe('id');
    expect(c.scope).toBe('public_repo');
  });
});

describe('credential store', () => {
  it('env token wins over stored oauth', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'yige-cred-'));
    process.env.YIGE_CONFIG_HOME = dir;
    saveCredentials({
      token: 'oauth-token',
      source: 'oauth',
      updatedAt: new Date().toISOString(),
    });
    process.env.YIGE_GITHUB_TOKEN = 'pat-token';
    expect(resolveToken()?.source).toBe('env');
    delete process.env.YIGE_GITHUB_TOKEN;
    delete process.env.GITHUB_TOKEN;
    expect(resolveToken()?.source).toBe('oauth');
    expect(loadCredentials()?.token).toBe('oauth-token');
    expect(clearCredentials()).toBe(true);
  });
});
