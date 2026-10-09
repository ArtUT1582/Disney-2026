@echo off
setlocal
set "HERE=%~dp0"
set "TARGET="
for %%F in ("%HERE%*song-language-wow.html") do set "TARGET=%%~fF"
if not defined TARGET (
  echo Could not find the file in %HERE%
  pause
  exit /b 1
)
set "CHROME="
if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" set "CHROME=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if not defined CHROME if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" set "CHROME=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
if not defined CHROME if exist "%LocalAppData%\Google\Chrome\Application\chrome.exe" set "CHROME=%LocalAppData%\Google\Chrome\Application\chrome.exe"
if defined CHROME (
  start "" "%CHROME%" --start-maximized "%TARGET%"
) else (
  echo Chrome not found - opening in the default browser.
  start "" "%TARGET%"
)
endlocal
