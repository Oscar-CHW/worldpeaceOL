/**
 * Environment Setup Script
 * Creates .env file with proper configuration for development
 */
const fs = require('fs');
const path = require('path');

// ANSI color codes for prettier console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m'
};

console.log('\n' + colors.bright + colors.cyan + '=================================' + colors.reset);
console.log(colors.bright + colors.cyan + '    World Peace Online Setup' + colors.reset);
console.log(colors.bright + colors.cyan + '=================================' + colors.reset + '\n');

// Check for .env file
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  console.log(colors.yellow + '.env file already exists.' + colors.reset);
  console.log('Do you want to overwrite it? (y/n)');
  
  // Simple synchronous input for basic script
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  rl.question('> ', (answer) => {
    if (answer.toLowerCase() !== 'y' && answer.toLowerCase() !== 'yes') {
      console.log(colors.yellow + 'Setup canceled. Existing .env file preserved.' + colors.reset);
      rl.close();
      return;
    }
    
    createEnvFile();
    rl.close();
  });
} else {
  createEnvFile();
}

function createEnvFile() {
  console.log(colors.yellow + 'Creating .env file...' + colors.reset);
  
  // Check for Google client credentials file
  const files = fs.readdirSync(__dirname);
  const clientSecretFile = files.find(file => file.startsWith('client_secret') && file.endsWith('.json'));
  
  let googleClientId = '';
  let googleClientSecret = '';
  let googleCallbackUrl = 'http://localhost:3000/api/auth/google/callback';
  
  // If client secret file exists, use its values
  if (clientSecretFile) {
    console.log(colors.green + `Found client secret file: ${clientSecretFile}` + colors.reset);
    
    try {
      const clientSecretContent = fs.readFileSync(path.join(__dirname, clientSecretFile), 'utf8');
      const clientSecret = JSON.parse(clientSecretContent);
      
      googleClientId = clientSecret.web.client_id;
      googleClientSecret = clientSecret.web.client_secret;
      
      console.log(colors.green + '✓ Extracted Google credentials' + colors.reset);
    } catch (error) {
      console.error(colors.red + `Error reading client secret file: ${error.message}` + colors.reset);
    }
  } else {
    console.log(colors.yellow + 'No Google client secret file found. Using placeholder values.' + colors.reset);
  }
  
  // Generate session secret
  const crypto = require('crypto');
  const sessionSecret = crypto.randomBytes(64).toString('hex');
  
  // Create .env content
  const envContent = `# Server configuration
NODE_ENV=development
PORT=3000
DEBUG_MODE=true
VERBOSE_LOGGING=true
SESSION_SECRET=${sessionSecret}

# Google OAuth configuration
GOOGLE_CLIENT_ID=${googleClientId}
GOOGLE_CLIENT_SECRET=${googleClientSecret}
GOOGLE_CALLBACK_URL=${googleCallbackUrl}`;
  
  // Write the file
  fs.writeFileSync(envPath, envContent);
  console.log(colors.green + '✓ .env file created successfully' + colors.reset);
  
  // Create db directory if it doesn't exist
  const dbDir = path.join(__dirname, 'db');
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
    console.log(colors.green + '✓ Created db directory for sessions' + colors.reset);
  }
  
  console.log('\n' + colors.bright + 'Setup complete!' + colors.reset);
  console.log('To start the development server:');
  console.log(colors.cyan + '  npm run setup' + colors.reset + ' (first time only)');
  console.log(colors.cyan + '  npm run dev' + colors.reset);
  console.log('\n' + colors.dim + 'For production deployment, set NODE_ENV=production in .env' + colors.reset + '\n');
} 