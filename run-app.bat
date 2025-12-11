@echo off
REM Run this from anywhere — it will CD to the script directory then start the app
cd /d "%~dp0"
echo Starting Patch Report Checking Automation (npm start)...
npm start
REM If the process exits, pause so you can read output
pause
