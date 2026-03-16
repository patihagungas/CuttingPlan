#!/usr/bin/env node
// Launch electron-vite dev with ELECTRON_RUN_AS_NODE removed
const { spawn } = require('child_process')
const path = require('path')

const env = { ...process.env }
delete env.ELECTRON_RUN_AS_NODE

const binPath = path.join(__dirname, '..', 'node_modules', '.bin', 'electron-vite.cmd')

// Use cmd.exe to run the .cmd batch file (required on Windows)
const child = spawn('cmd', ['/c', `"${binPath}"`, 'dev'], {
  stdio: 'inherit',
  env,
  shell: false,
  windowsVerbatimArguments: true
})

child.on('close', code => process.exit(code ?? 0))
child.on('error', err => {
  console.error('Launch failed:', err.message)
  process.exit(1)
})
