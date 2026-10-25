@echo off
cd /d "%~dp0"
node scripts\windows-tunnel.mjs
if errorlevel 1 pause
