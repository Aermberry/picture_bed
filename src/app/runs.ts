import fs from 'node:fs';
import path from 'node:path';

export interface RunRecord {
  id: string;
  command: string;
  startedAt: string;
  finishedAt: string;
  ok: boolean;
  counts: Record<string, number>;
  items?: unknown[];
  errors?: string[];
  warnings?: string[];
  errorCode?: string;
}

export function runsDir(cwd: string): string {
  return path.join(cwd, '.picbed', 'runs');
}

export function recordRun(cwd: string, record: RunRecord): void {
  const dir = runsDir(cwd);
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${record.id}.json`);
  fs.writeFileSync(file, JSON.stringify(record, null, 2) + '\n', 'utf8');
}

export function listRuns(cwd: string, limit = 20): RunRecord[] {
  const dir = runsDir(cwd);
  if (!fs.existsSync(dir)) return [];
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .reverse()
    .slice(0, limit);
  const out: RunRecord[] = [];
  for (const f of files) {
    try {
      out.push(JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')) as RunRecord);
    } catch {
      /* skip corrupt run file */
    }
  }
  return out;
}

export function getRun(cwd: string, id: string): RunRecord | null {
  if (!/^[a-zA-Z0-9_-]+$/.test(id)) return null;
  const file = path.join(runsDir(cwd), `${id}.json`);
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8')) as RunRecord;
  } catch {
    return null;
  }
}

export function newRunId(): string {
  return `run_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
