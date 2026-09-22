#!/usr/bin/env node
import readline from 'node:readline';
import { formatMessage, handleRpc, parseLine } from '../dist/mcp/server.js';

const rl = readline.createInterface({ input: process.stdin, terminal: false });

rl.on('line', async (line) => {
  let msg;
  try {
    msg = parseLine(line);
  } catch {
    return;
  }
  if (!msg) return;
  const reply = await handleRpc(msg);
  if (!reply) return;
  const messages = Array.isArray(reply) ? reply : [reply];
  for (const m of messages) {
    process.stdout.write(formatMessage(m) + '\n');
  }
});
