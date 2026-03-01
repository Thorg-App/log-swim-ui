#!/usr/bin/env node

// CLI entry point for log-swim-ui.
// Spawns Electron with the app directory and forwards CLI args and stdin.

const { spawn } = require('child_process')
const path = require('path')

let electronPath
try {
  // WHY: require('electron') returns the path to the Electron binary
  // (not the module itself) when called from a Node.js context.
  electronPath = require('electron')
} catch {
  process.stderr.write(
    'Error: electron is not installed. Install it with: npm install electron\n'
  )
  process.exit(1)
}

const appPath = path.resolve(__dirname, '..')

// WHY: Using 'pipe' for stdin so the parent process's stdin (which contains
// the log stream) is forwarded to the Electron child process. stdout and stderr
// are inherited so Electron's output is visible in the terminal.
const child = spawn(electronPath, [appPath, ...process.argv.slice(2)], {
  stdio: ['pipe', 'inherit', 'inherit']
})

// Pipe parent's stdin to child
process.stdin.pipe(child.stdin)

child.on('close', (code) => {
  process.exit(code ?? 0)
})

child.on('error', (err) => {
  process.stderr.write(`Failed to start Electron: ${err.message}\n`)
  process.exit(1)
})
