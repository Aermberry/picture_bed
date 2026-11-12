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

/**
 * 全量读取（不按文件名截断），坏记录可报告——F25 v2 统计的 runs 唯一计数源。
 * 与 listRuns 的差异：①不截断；②单文件损坏不静默跳过，而是计入 corrupt 且回报文件数。
 * 文件格式与写入侧（recordRun）不变。
 */
export function scanAllRuns(
  cwd: string,
): { runs: RunRecord[]; corruptFiles: number } {
  const dir = runsDir(cwd);
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (err) {
    // 目录不存在 → 无记录（状态判定表第 1 行的上游）；其他错误（如 runs 路径不是目录）→ 抛给聚合层降级
    if ((err as NodeJS.ErrnoException)?.code === 'ENOENT') {
      return { runs: [], corruptFiles: 0 };
    }
    throw err;
  }
  const out: RunRecord[] = [];
  let corruptFiles = 0;
  for (const ent of entries) {
    if (!ent.isFile() || !ent.name.endsWith('.json')) continue;
    try {
      out.push(JSON.parse(fs.readFileSync(path.join(dir, ent.name), 'utf8')) as RunRecord);
    } catch {
      corruptFiles += 1;
    }
  }
  return { runs: out, corruptFiles };
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
