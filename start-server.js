const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// ANSI color codes for prettier console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m'
};

// Print a styled header
console.log('\n' + colors.bright + colors.cyan + '==================================' + colors.reset);
console.log(colors.bright + colors.cyan + '    天下太平 Web Server Starter' + colors.reset);
console.log(colors.bright + colors.cyan + '==================================' + colors.reset + '\n');

// Check if server.js exists
const serverPath = path.join(__dirname, 'server.js');
if (!fs.existsSync(serverPath)) {
  console.error(colors.red + 'ERROR: server.js file not found!' + colors.reset);
  console.error('Make sure you are running this script from the website directory.');
  process.exit(1);
}

// Check if the required node_modules are installed
try {
  require('@prisma/client');
  require('express');
  require('bcrypt');
} catch (error) {
  console.error(colors.red + 'ERROR: Missing dependencies!' + colors.reset);
  console.error('Please run "npm install" to install the required dependencies.');
  console.error('Detailed error: ' + error.message);
  process.exit(1);
}

console.log(colors.green + '✓ Dependencies check passed' + colors.reset);
console.log(colors.green + '✓ Server file found' + colors.reset);
console.log('\n' + colors.yellow + 'Starting server...' + colors.reset + '\n');

let serverProcess = null;

function startServer() {
  // Start the server as a separate process
  serverProcess = spawn('node', ['server.js'], { stdio: 'inherit' });

  // Server URL
  console.log(colors.bright + '\nServer will be available at: ' + 
    colors.cyan + 'http://localhost:3000' + colors.reset);
  console.log(colors.dim + 'Press Ctrl+R to restart the server' + colors.reset + '\n');

  // Handle server process events
  serverProcess.on('close', (code) => {
    if (code !== 0) {
      console.log(colors.red + `\nServer process exited with code ${code}` + colors.reset);
    } else {
      console.log(colors.green + '\nServer stopped successfully.' + colors.reset);
    }
  });
}

// Initial server start
startServer();

// Handle Ctrl+R to restart the server
process.stdin.setRawMode(true);
process.stdin.resume();
process.stdin.on('data', (data) => {
  if (data[0] === 18) { // Ctrl+R
    console.log(colors.yellow + '\nRestarting server...' + colors.reset);
    if (serverProcess) {
      serverProcess.kill('SIGTERM');
    }
    startServer();
  }
});

// Handle signals to gracefully shut down
process.on('SIGINT', () => {
  console.log(colors.yellow + '\nShutting down server...' + colors.reset);
  if (serverProcess) {
    serverProcess.kill('SIGINT');
  }
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log(colors.yellow + '\nShutting down server...' + colors.reset);
  if (serverProcess) {
    serverProcess.kill('SIGTERM');
  }
  process.exit(0);
}); 