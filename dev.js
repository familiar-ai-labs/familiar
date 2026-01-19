'use strict';

const path = require('path');
const { spawn } = require('child_process');
const dotenvResult = require('dotenv').config({
  path: path.resolve(__dirname, '.env')
});

if (dotenvResult.error) {
  console.warn('[dev] No .env loaded:', dotenvResult.error.message);
}

const electronPath = require('electron');
const child = spawn(electronPath, ['.'], {
  cwd: __dirname,
  env: process.env,
  stdio: 'inherit'
});

child.on('error', (error) => {
  console.error('[dev] Failed to start Electron:', error.message);
  process.exit(1);
});

child.on('exit', (code, signal) => {
  if (signal) {
    console.warn(`[dev] Electron exited with signal ${signal}`);
    process.exit(1);
  }

  process.exit(code ?? 0);
});
