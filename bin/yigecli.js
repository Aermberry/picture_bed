#!/usr/bin/env node
import { run } from '../dist/cli.js';

run(process.argv).then(
  (code) => {
    process.exitCode = code;
  },
  (err) => {
    console.error(err);
    process.exitCode = 1;
  },
);
