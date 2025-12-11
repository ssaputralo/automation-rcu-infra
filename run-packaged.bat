@echo off
REM run-packaged.bat - Run packaged app (standalone Windows build)
REM Place this .bat next to the packaged application executable/folder and run it.
cd /d "%~dp0"

rem Candidate executable names (try common variations)
set EXE_NAME=patch-report-checking-automation.exe
set EXE_NAME2=PatchReportCheckingAutomation.exe
set EXE_NAME3=%~n0.exe

rem Specific build output path you provided (common electron-forge naming)
set "SPECIFIC_EXE=out\patch-report-checking-automation-win32-x64\patch-report-checking-automation.exe"

:find_and_run

rem If the specific path exists, prefer it (handles your provided path)
if exist "%SPECIFIC_EXE%" (
	echo Found packaged exe at %SPECIFIC_EXE% - launching...
	start "" "%SPECIFIC_EXE%"
	goto end
)

:find_and_run
if exist "%EXE_NAME%" (
	echo Found %EXE_NAME% - launching...
	start "" "%EXE_NAME%"
	goto end
)
if exist "%EXE_NAME2%" (
	echo Found %EXE_NAME2% - launching...
	start "" "%EXE_NAME2%"
	goto end
)
if exist "%EXE_NAME3%" (
	echo Found %EXE_NAME3% - launching...
	start "" "%EXE_NAME3%"
	goto end
)

rem Fallback: launch the first .exe in the current directory (excluding this batch if it's an exe)
for %%f in (*.exe) do (
	if /I not "%%~nxf"=="%~nx0" (
		echo Found executable %%f - launching...
		start "" "%%~f"
		goto end
	)
)

rem Also check common maker output folders (if you distribute the whole maker output directory)
if exist "out\make" (
	for /f "delims=" %%d in ('dir /b out\make') do (
		if exist "out\make\%%d\win-unpacked\%EXE_NAME%" (
			echo Found unpacked build - launching...
			start "" "out\make\%%d\win-unpacked\%EXE_NAME%"
			goto end
		)
	)
)

echo Could not find a packaged executable in this folder.
echo To create a standalone distributable, build on a machine with Node.js installed and run:
echo   npm install
echo   npm run make
echo
echo Then copy the produced installer or unpacked directory to target PCs; place this .bat next to the exe and run it.

:end
pause

































:endpauseecho Then copy the produced installer or unpacked directory to target PCs; place this .bat next to the exe and run it.echoecho   npm run makeecho   npm installecho To create a standalone distributable, build on a machine with Node.js installed and run:
necho Could not find a packaged executable in this folder.)  )    goto end    start "" "out\make\%%f\win-unpacked\%EXE_NAME%"  for /f "delims=" %%f in ('dir /b /ad out\make\*\win-unpacked') do (  echo Found unpacked build - launching...if exist "out\make\*\win-unpacked\%EXE_NAME%" (
nREM Also check common maker output folders (if you distribute the whole maker output directory))  goto end  start "" "%EXE_NAME3%"  echo Found %EXE_NAME3% - launching...if exist "%EXE_NAME3%" ()  goto end  start "" "%EXE_NAME2%"  echo Found %EXE_NAME2% - launching...if exist "%EXE_NAME2%" ()  goto end  start "" "%EXE_NAME%"  echo Found %EXE_NAME% - launching...if exist "%EXE_NAME%" (n:find_and_run