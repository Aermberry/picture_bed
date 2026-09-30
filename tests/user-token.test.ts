import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  clearUserToken,
  readUserToken,
  userTokenPath,
  writeUserToken,
} from '../src/user-token.js';

const prevPath = process.env.PICBED_USER_TOKEN_PATH;
let tmpFile: string;

beforeEach(() => {
  tmpFile = path.join(os.tmpdir(), `picbed-test-cred-${Date.now()}-${Math.random()}.json`);
  process.env.PICBED_USER_TOKEN_PATH = tmpFile;
});

afterEach(() => {
  if (prevPath === undefined) delete process.env.PICBED_USER_TOKEN_PATH;
  else process.env.PICBED_USER_TOKEN_PATH = prevPath;
  if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
  const dir = path.dirname(tmpFile);
  if (fs.existsSync(dir) && path.basename(dir) === '.picbed') {
    try {
      fs.rmdirSync(dir);
    } catch {
      /* keep */
    }
  }
});

describe('user token store', () => {
  it('round-trips a PAT outside the project tree', () => {
    writeUserToken('ghp_test_token_value');
    expect(userTokenPath()).toBe(path.resolve(tmpFile));
    expect(readUserToken()).toBe('ghp_test_token_value');
  });

  it('clear removes the file', () => {
    writeUserToken('ghp_test_token_value');
    clearUserToken();
    expect(readUserToken()).toBeUndefined();
  });

  it('returns undefined when file missing or invalid', () => {
    expect(readUserToken()).toBeUndefined();
    fs.writeFileSync(tmpFile, 'not-json', 'utf8');
    expect(readUserToken()).toBeUndefined();
  });
});
