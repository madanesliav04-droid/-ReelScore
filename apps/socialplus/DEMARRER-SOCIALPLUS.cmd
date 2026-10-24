@echo off
cd /d "%~dp0"
node scripts\windows-local.mjs
if errorlevel 1 pause
