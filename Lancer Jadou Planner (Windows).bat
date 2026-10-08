@echo off
chcp 65001 >nul
title Jadou Planner
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js n'est pas installe. Telecharge-le sur https://nodejs.org (version LTS), puis relance ce fichier.
  start https://nodejs.org
  pause
  exit /b 1
)
if not exist node_modules goto install
if not exist web\dist goto install
goto run
:install
echo Premiere installation (quelques minutes)...
call npm install || (pause & exit /b 1)
call npm run migrate || (pause & exit /b 1)
call npm run build || (pause & exit /b 1)
:run
start "" cmd /c "timeout /t 6 >nul & start http://localhost:4317"
set NODE_ENV=production
call npm run migrate
call npx tsx server/src/index.ts
pause
