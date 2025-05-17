/**
 * Script to update server.js with the new modular version
 */
const fs = require('fs');
const path = require('path');

// Get current date for backup filename
const date = new Date();
const timestamp = `${date.getFullYear()}${(date.getMonth() + 1).toString().padStart(2, '0')}${date.getDate().toString().padStart(2, '0')}_${date.getHours().toString().padStart(2, '0')}${date.getMinutes().toString().padStart(2, '0')}`;

// Paths
const oldServerPath = path.join(__dirname, 'server.js');
const newServerPath = path.join(__dirname, 'server-new.js');
const backupPath = path.join(__dirname, 'backup', `server_${timestamp}.js`);

// Ensure backup directory exists
const backupDir = path.join(__dirname, 'backup');
if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
}

// Check if files exist
if (!fs.existsSync(newServerPath)) {
    console.error('New server file not found!');
    process.exit(1);
}

// Create backup of old server.js if it exists
if (fs.existsSync(oldServerPath)) {
    try {
        // Copy old server.js to backup
        fs.copyFileSync(oldServerPath, backupPath);
        console.log(`✅ Old server.js backed up to ${backupPath}`);
        
        // Remove old server.js
        fs.unlinkSync(oldServerPath);
        console.log('✅ Old server.js removed');
    } catch (error) {
        console.error('Error backing up old server.js:', error);
        process.exit(1);
    }
}

// Copy new server.js
try {
    fs.copyFileSync(newServerPath, oldServerPath);
    console.log('✅ New server.js installed');
} catch (error) {
    console.error('Error installing new server.js:', error);
    process.exit(1);
}

console.log('✅ Server update completed successfully!');
console.log('To start the server, run: node server.js'); 