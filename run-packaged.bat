@echo off
REM run-packaged.bat - Run packaged app (standalone Windows build)
REM Place this .bat next to the packaged application executable/folder and run it.
cd /d "%~dp0"

rem Candidate executable names (try common variations)
set EXE_NAME=patch-report-checking-automation.exe
set EXE_NAME2=PatchReportCheckingAutomation.exe
set EXE_NAME3=%~n0.exe

































:endpauseecho Then copy the produced installer or unpacked directory to target PCs; place this .bat next to the exe and run it.echoecho   npm run makeecho   npm installecho To create a standalone distributable, build on a machine with Node.js installed and run:
necho Could not find a packaged executable in this folder.)  )    goto end    start "" "out\make\%%f\win-unpacked\%EXE_NAME%"  for /f "delims=" %%f in ('dir /b /ad out\make\*\win-unpacked') do (  echo Found unpacked build - launching...if exist "out\make\*\win-unpacked\%EXE_NAME%" (
nREM Also check common maker output folders (if you distribute the whole maker output directory))  goto end  start "" "%EXE_NAME3%"  echo Found %EXE_NAME3% - launching...if exist "%EXE_NAME3%" ()  goto end  start "" "%EXE_NAME2%"  echo Found %EXE_NAME2% - launching...if exist "%EXE_NAME2%" ()  goto end  start "" "%EXE_NAME%"  echo Found %EXE_NAME% - launching...if exist "%EXE_NAME%" (n:find_and_run