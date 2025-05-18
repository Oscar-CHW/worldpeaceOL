@echo off
REM Build script for 天下太平 web app

REM Install dependencies
call npm install

REM Run Prisma migrations and generate client
call npx prisma migrate deploy
call npx prisma generate

echo Build complete.
pause
