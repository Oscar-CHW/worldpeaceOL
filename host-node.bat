@echo off
echo Setting up Node.js server for "天下太平" website...
echo.

REM Check if Node.js is installed
where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
  echo Error: Node.js is not installed or not in your PATH.
  echo Please install Node.js from https://nodejs.org/
  pause
  exit /b
)

REM Install dependencies if node_modules doesn't exist
if not exist node_modules (
  echo Installing dependencies...
  npm install
)

REM Initialize Prisma if needed
if not exist prisma\migrations (
  echo Initializing database...
  npx prisma migrate dev --name init
)

echo.
echo Starting server...
echo.
echo Your website will be available at: http://localhost:3000
echo.
echo Press Ctrl+C to stop the server when finished.
echo.

npm start
pause 