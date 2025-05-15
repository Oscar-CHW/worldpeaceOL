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

// Check if Prisma is initialized (dev.db and migrations exist)
const prismaDir = path.join(__dirname, 'prisma');
const devDbPath = path.join(prismaDir, 'dev.db');
const migrationsDir = path.join(prismaDir, 'migrations');
const schemaPath = path.join(prismaDir, 'schema.prisma');

function runPrismaGenerate() {
  const { spawnSync } = require('child_process');
  const result = spawnSync('npx', ['prisma', 'generate'], { stdio: 'inherit', shell: true });
  if (result.status !== 0) {
    console.error(colors.red + 'ERROR: Failed to generate Prisma client.' + colors.reset);
    process.exit(1);
  }
}

function runPrismaMigrate() {
  const { spawnSync } = require('child_process');
  const result = spawnSync('npx', ['prisma', 'migrate', 'deploy'], { stdio: 'inherit', shell: true });
  if (result.status !== 0) {
    console.error(colors.red + 'ERROR: Failed to run Prisma migrations.' + colors.reset);
    process.exit(1);
  }
}

// Initialize Prisma if needed before starting the server
if (!fs.existsSync(devDbPath) || !fs.existsSync(migrationsDir) || !fs.existsSync(schemaPath)) {
  console.log(colors.yellow + 'Prisma database or migrations not found. Initializing Prisma...' + colors.reset);
  runPrismaMigrate();
  runPrismaGenerate();
  console.log(colors.green + '✓ Prisma database and client initialized.' + colors.reset);
} else {
  console.log(colors.green + '✓ Prisma database and migrations found.' + colors.reset);
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

