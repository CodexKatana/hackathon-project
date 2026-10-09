@echo off
cd /d "%~dp0frontend"
echo Installing JavaScript dependencies...
call npm ci
if errorlevel 1 (
  echo Node.js setup failed. Install Node.js from https://nodejs.org/
  pause
  exit /b 1
)
echo Starting frontend on http://localhost:3000
call npm run dev
pause
