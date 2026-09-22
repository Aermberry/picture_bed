import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { handleRpc, MCP_TOOLS, runCliJson } from '../src/mcp/server.js';

const cliPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../bin/yigecli.js');

function tmp(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'yigecli-mcp-'));
}

describe('F14 MCP wrapper', () => {
  it('lists tools without business logic', async () => {
    const res = (await handleRpc({ jsonrpc: '2.0', id: 1, method: 'tools/list' })) as {
      result: { tools: { name: string }[] };
    };
    expect(res.result.tools.map((t) => t.name)).toEqual(MCP_TOOLS.map((t) => t.name));
  });

  it('initialize advertises tools capability', async () => {
    const res = (await handleRpc({
      jsonrpc: '2.0',
      id: 2,
      method: 'initialize',
      params: {},
    })) as { result: { protocolVersion: string; capabilities: { tools: unknown } } };
    expect(res.result.protocolVersion).toBeTruthy();
    expect(res.result.capabilities.tools).toBeTruthy();
  });

  it('tools/call delegates to yigecli --json (local host, no token)', async () => {
    const root = tmp();
    fs.writeFileSync(
      path.join(root, 'yigecli.toml'),
      `[host]
type = "local"

[local]
root = "bed"
public_base = "https://img.example.com"
dir = "img"

[url]
style = "raw"
`,
    );
    fs.writeFileSync(path.join(root, 'note.md'), '![a](./a.png)\n');
    fs.writeFileSync(path.join(root, 'a.png'), Buffer.from([1, 2, 3]));

    const res = (await handleRpc(
      {
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: { name: 'yigecli_plan', arguments: { path: '.' } },
      },
      { cliPath, cwd: root },
    )) as { result: { content: { text: string }[]; isError: boolean } };

    expect(res.result.isError).toBe(false);
    const payload = JSON.parse(res.result.content[0].text) as {
      ok: boolean;
      data: { summary: Record<string, number> };
    };
    expect(payload.ok).toBe(true);
    expect(payload.data.summary.upload).toBeGreaterThan(0);
  });

  it('runCliJson returns exit code and stdout', async () => {
    const out = await runCliJson(cliPath, ['commands', '--json']);
    expect(out.code).toBe(0);
    expect(out.stdout).toContain('schemaVersion');
  });
});
