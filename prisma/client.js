/**
 * Prisma Client module
 * Exports a single instance of PrismaClient to be used throughout the app
 */
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

module.exports = prisma; 