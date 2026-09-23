import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export interface JsonRpcMessage {
  jsonrpc: '2.0';
  id?: number | string | null;
  method?: string;
  params?: unknown;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

export interface McpToolSpec {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  /** CLI argv after `picbed` (placeholders filled from arguments). */
  buildArgs: (args: Record<string, unknown>) => string[];
}

/** F14 tools: thin wrappers over the picbed CLI contract — no business rules. */
export const MCP_TOOLS: McpToolSpec[] = [
  {
    name: 'picbed_doctor',
    description: 'Run picbed doctor (config / token / API self-check) with --json',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    buildArgs: () => ['doctor', '--json'],
  },
  {
    name: 'picbed_scan',
    description: 'Scan docs and extract image refs under a path',
    inputSchema: {
      type: 'object',
      properties: { path: { type: 'string', description: 'directory or file root' } },
      required: ['path'],
      additionalProperties: false,
    },
    buildArgs: (a) => ['scan', String(a.path), '--json'],
  },
  {
    name: 'picbed_plan',
    description: 'Build upload plan without writing or uploading',
    inputSchema: {
      type: 'object',
      properties: { path: { type: 'string' } },
      required: ['path'],
      additionalProperties: false,
    },
    buildArgs: (a) => ['plan', String(a.path), '--json'],
  },
  {
    name: 'picbed_sync',
    description: 'Upload images and rewrite links (requires yes=true unless dryRun)',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string' },
        yes: { type: 'boolean' },
        dryRun: { type: 'boolean' },
      },
      required: ['path'],
      additionalProperties: false,
    },
    buildArgs: (a) => {
      const args = ['sync', String(a.path), '--json'];
      if (a.yes) args.push('--yes');
      if (a.dryRun) args.push('--dry-run');
      return args;
    },
  },
  {
    name: 'picbed_upload',
    description: 'Upload a single image file and return publicUrl',
    inputSchema: {
      type: 'object',
      properties: { file: { type: 'string' } },
      required: ['file'],
      additionalProperties: false,
    },
    buildArgs: (a) => ['upload', String(a.file), '--json'],
  },
  {
    name: 'picbed_revert',
    description: 'Revert public URLs back to original local refs (requires yes=true unless dryRun)',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string' },
        yes: { type: 'boolean' },
        dryRun: { type: 'boolean' },
      },
      required: ['path'],
      additionalProperties: false,
    },
    buildArgs: (a) => {
      const args = ['revert', String(a.path), '--json'];
      if (a.yes) args.push('--yes');
      if (a.dryRun) args.push('--dry-run');
      return args;
    },
  },
];

export function defaultCliPath(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(here, '../../bin/picbed.js');
}

export async function runCliJson(
  cliPath: string,
  args: string[],
  cwd?: string,
): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [cliPath, ...args], {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => {
      stdout += String(d);
    });
    child.stderr.on('data', (d) => {
      stderr += String(d);
    });
    child.on('error', (err) => {
      resolve({ code: 1, stdout, stderr: String(err) });
    });
    child.on('close', (code) => {
      resolve({ code: code ?? 1, stdout, stderr });
    });
  });
}

export async function handleRpc(
  msg: JsonRpcMessage,
  opts: { cliPath?: string; cwd?: string } = {},
): Promise<JsonRpcMessage | JsonRpcMessage[] | null> {
  const cliPath = opts.cliPath ?? defaultCliPath();
  const id = msg.id;

  if (msg.method === 'initialize') {
    return {
      jsonrpc: '2.0',
      id,
      result: {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: { name: 'picbed-mcp', version: '0.3.0' },
      },
    };
  }
  if (msg.method === 'notifications/initialized' || msg.method === 'notifications/cancelled') {
    return null;
  }
  if (msg.method === 'ping') {
    return { jsonrpc: '2.0', id, result: {} };
  }
  if (msg.method === 'tools/list') {
    return {
      jsonrpc: '2.0',
      id,
      result: {
        tools: MCP_TOOLS.map((t) => ({
          name: t.name,
          description: t.description,
          inputSchema: t.inputSchema,
        })),
      },
    };
  }
  if (msg.method === 'tools/call') {
    const params = (msg.params ?? {}) as { name?: string; arguments?: Record<string, unknown> };
    const tool = MCP_TOOLS.find((t) => t.name === params.name);
    if (!tool) {
      return {
        jsonrpc: '2.0',
        id,
        error: { code: -32602, message: `unknown tool: ${params.name}` },
      };
    }
    const args = tool.buildArgs(params.arguments ?? {});
    const result = await runCliJson(cliPath, args, opts.cwd);
    let text = result.stdout.trim();
    if (!text) text = result.stderr.trim() || `exit ${result.code}`;
    return {
      jsonrpc: '2.0',
      id,
      result: {
        content: [{ type: 'text', text }],
        isError: result.code !== 0,
      },
    };
  }
  if (id === undefined || id === null) return null;
  return {
    jsonrpc: '2.0',
    id,
    error: { code: -32601, message: `method not found: ${msg.method}` },
  };
}

export function parseLine(line: string): JsonRpcMessage | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  return JSON.parse(trimmed) as JsonRpcMessage;
}

export function formatMessage(msg: JsonRpcMessage): string {
  return JSON.stringify(msg);
}
