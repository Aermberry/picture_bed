import crypto from 'node:crypto';
import http from 'node:http';
import { spawn } from 'node:child_process';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { loadCredentials, saveCredentials, type StoredCredentials } from './store.js';

export const DEFAULT_CALLBACK_PORT = 53682;

export interface OAuthClientConfig {
  clientId: string;
  clientSecret: string;
  scope?: string;
  callbackPort?: number;
}

export interface LoginResult extends StoredCredentials {
  path: string;
  mode: 'callback' | 'device';
}

export function requireOAuthClient(env: NodeJS.ProcessEnv = process.env): {
  clientId: string;
  clientSecret: string;
  scope: string;
} {
  const clientId = env.YIGE_GITHUB_CLIENT_ID || '';
  const clientSecret = env.YIGE_GITHUB_CLIENT_SECRET || '';
  if (!clientId || !clientSecret) {
    throw Object.assign(
      new Error(
        'missing YIGE_GITHUB_CLIENT_ID / YIGE_GITHUB_CLIENT_SECRET (create a GitHub OAuth App, callback http://127.0.0.1:53682/callback)',
      ),
      { code: 'E_CONFIG' },
    );
  }
  const scope = env.YIGE_GITHUB_SCOPE || 'repo';
  return { clientId, clientSecret, scope };
}

export function randomState(): string {
  return crypto.randomBytes(16).toString('hex');
}

export function authorizeUrl(args: {
  clientId: string;
  redirectUri: string;
  scope: string;
  state: string;
}): string {
  const u = new URL('https://github.com/login/oauth/authorize');
  u.searchParams.set('client_id', args.clientId);
  u.searchParams.set('redirect_uri', args.redirectUri);
  u.searchParams.set('scope', args.scope);
  u.searchParams.set('state', args.state);
  return u.toString();
}

export function openBrowser(url: string): void {
  const platform = process.platform;
  try {
    if (platform === 'win32') {
      spawn('cmd', ['/c', 'start', '', url], { detached: true, stdio: 'ignore' }).unref();
    } else if (platform === 'darwin') {
      spawn('open', [url], { detached: true, stdio: 'ignore' }).unref();
    } else {
      spawn('xdg-open', [url], { detached: true, stdio: 'ignore' }).unref();
    }
  } catch {
    // caller prints URL as fallback
  }
}

export async function exchangeCode(args: {
  clientId: string;
  clientSecret: string;
  code: string;
  redirectUri: string;
}): Promise<{ access_token: string; token_type?: string; scope?: string; error?: string }> {
  const res = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'User-Agent': 'yigecli',
    },
    body: JSON.stringify({
      client_id: args.clientId,
      client_secret: args.clientSecret,
      code: args.code,
      redirect_uri: args.redirectUri,
    }),
  });
  return (await res.json()) as {
    access_token: string;
    token_type?: string;
    scope?: string;
    error?: string;
  };
}

export async function loginWithCallback(opts: {
  clientId: string;
  clientSecret: string;
  scope?: string;
  port?: number;
  open?: boolean;
  timeoutMs?: number;
}): Promise<LoginResult> {
  const port = opts.port ?? DEFAULT_CALLBACK_PORT;
  const scope = opts.scope ?? 'repo';
  const state = randomState();
  const redirectUri = `http://127.0.0.1:${port}/callback`;

  const codePromise = new Promise<string>((resolve, reject) => {
    const server = http.createServer((req: IncomingMessage, res: ServerResponse) => {
      try {
        const url = new URL(req.url || '/', redirectUri);
        if (url.pathname !== '/callback') {
          res.writeHead(404).end('not found');
          return;
        }
        const err = url.searchParams.get('error');
        const code = url.searchParams.get('code');
        const gotState = url.searchParams.get('state');
        if (err) {
          res.writeHead(400, { 'Content-Type': 'text/plain' });
          res.end('authorization failed: ' + err);
          server.close();
          reject(Object.assign(new Error(`oauth error: ${err}`), { code: 'E_AUTH' }));
          return;
        }
        if (!code || gotState !== state) {
          res.writeHead(400, { 'Content-Type': 'text/plain' });
          res.end('invalid state or code');
          server.close();
          reject(
            Object.assign(new Error('oauth state mismatch or missing code'), {
              code: 'E_AUTH',
            }),
          );
          return;
        }
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(
          '<!doctype html><meta charset="utf-8"><title>yigecli</title><p>登录成功，可关闭此页并回到终端。</p>',
        );
        server.close();
        resolve(code);
      } catch (e) {
        server.close();
        reject(e as Error);
      }
    });

    server.listen(port, '127.0.0.1', () => {
      const url = authorizeUrl({
        clientId: opts.clientId,
        redirectUri,
        scope,
        state,
      });
      if (opts.open !== false) openBrowser(url);
      // expose URL via thrown-less side channel
      (server as unknown as { __authUrl?: string }).__authUrl = url;
    });

    const timeout = opts.timeoutMs ?? 180_000;
    setTimeout(() => {
      server.close();
      reject(
        Object.assign(new Error('oauth callback timeout'), { code: 'E_AUTH' }),
      );
    }, timeout).unref?.();
  });

  // wait until listening so we can print URL
  await new Promise((r) => setTimeout(r, 50));
  // re-print is handled by caller using authorizeUrl; proceed to await code
  const code = await codePromise;
  const tokenRes = await exchangeCode({
    clientId: opts.clientId,
    clientSecret: opts.clientSecret,
    code,
    redirectUri,
  });
  if (!tokenRes.access_token) {
    throw Object.assign(
      new Error(tokenRes.error || 'no access_token from GitHub'),
      { code: 'E_AUTH' },
    );
  }
  const cred: StoredCredentials = {
    token: tokenRes.access_token,
    tokenType: tokenRes.token_type,
    scope: tokenRes.scope,
    source: 'oauth',
    updatedAt: new Date().toISOString(),
  };
  const path = saveCredentials(cred);
  return { ...cred, path, mode: 'callback' };
}

export interface DeviceStart {
  device_code: string;
  user_code: string;
  verification_uri: string;
  expires_in: number;
  interval: number;
}

export async function startDeviceLogin(clientId: string, scope = 'repo'): Promise<DeviceStart> {
  const res = await fetch('https://github.com/login/device/code', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'User-Agent': 'yigecli',
    },
    body: JSON.stringify({ client_id: clientId, scope }),
  });
  const body = (await res.json()) as DeviceStart & { error?: string };
  if (!body.device_code) {
    throw Object.assign(new Error(body.error || 'device code request failed'), {
      code: 'E_AUTH',
    });
  }
  return body;
}

export async function pollDeviceToken(args: {
  clientId: string;
  clientSecret: string;
  deviceCode: string;
  interval?: number;
  timeoutMs?: number;
}): Promise<{ access_token: string; token_type?: string; scope?: string }> {
  const interval = Math.max(2, args.interval ?? 5);
  const deadline = Date.now() + (args.timeoutMs ?? 180_000);
  for (;;) {
    if (Date.now() > deadline) {
      throw Object.assign(new Error('device login timeout'), { code: 'E_AUTH' });
    }
    await new Promise((r) => setTimeout(r, interval * 1000));
    const res = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'User-Agent': 'yigecli',
      },
      body: JSON.stringify({
        client_id: args.clientId,
        client_secret: args.clientSecret,
        device_code: args.deviceCode,
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
      }),
    });
    const body = (await res.json()) as {
      access_token?: string;
      token_type?: string;
      scope?: string;
      error?: string;
      error_description?: string;
      interval?: number;
    };
    if (body.access_token) {
      return {
        access_token: body.access_token,
        token_type: body.token_type,
        scope: body.scope,
      };
    }
    if (body.error === 'authorization_pending') continue;
    if (body.error === 'slow_down') {
      await new Promise((r) => setTimeout(r, 5000));
      continue;
    }
    throw Object.assign(
      new Error(body.error_description || body.error || 'device auth failed'),
      { code: 'E_AUTH' },
    );
  }
}

export async function loginWithDevice(opts: {
  clientId: string;
  clientSecret: string;
  scope?: string;
  open?: boolean;
  timeoutMs?: number;
}): Promise<LoginResult> {
  const start = await startDeviceLogin(opts.clientId, opts.scope ?? 'repo');
  if (opts.open !== false) openBrowser(start.verification_uri);
  const token = await pollDeviceToken({
    clientId: opts.clientId,
    clientSecret: opts.clientSecret,
    deviceCode: start.device_code,
    interval: start.interval,
    timeoutMs: opts.timeoutMs,
  });
  const cred: StoredCredentials = {
    token: token.access_token,
    tokenType: token.token_type,
    scope: token.scope,
    source: 'oauth',
    updatedAt: new Date().toISOString(),
  };
  const path = saveCredentials(cred);
  return { ...cred, path, mode: 'device' };
}

export function maskSecret(value: string | undefined): string {
  if (!value) return '';
  if (value.length <= 8) return '****';
  return value.slice(0, 4) + '****';
}

export function hasStoredLogin(): boolean {
  return Boolean(loadCredentials()?.token);
}
