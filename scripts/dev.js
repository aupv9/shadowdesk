#!/usr/bin/env node
/**
 * Dev launcher that strips ELECTRON_RUN_AS_NODE from environment.
 * Claude Code sets this env var to run Electron as Node, which
 * breaks Electron app startup. We must delete it before launching.
 */
const { spawn } = require('child_process')
const path = require('path')

const env = { ...process.env }
delete env.ELECTRON_RUN_AS_NODE

const evBin = path.join(__dirname, '..', 'node_modules', '.bin', 'electron-vite')

const child = spawn(
  process.platform === 'win32' ? evBin + '.cmd' : evBin,
  ['dev'],
  { env, stdio: 'inherit', shell: true }
)

child.on('close', (code) => process.exit(code ?? 0))
