@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Instale o Node.js LTS em https://nodejs.org/ e abra este arquivo novamente.
  pause
  exit /b 1
)
if not exist node_modules\playwright\package.json (
  echo Instalando dependencias do projeto...
  call npm.cmd install
  if errorlevel 1 (
    pause
    exit /b 1
  )
)
node src\cli.js %*
pause
