@echo off
rem Called by start.bat and pfsf.bat. Makes sure a project-local copy of the latest stable Bun lives in
rem .runtime\bun\ (git-ignored) and sets BUN to its path in the caller's environment.
rem
rem   set PFSF_BUN=C:\path\to\bun.exe   use this Bun instead (skips download)
rem   set PFSF_BUN_UPDATE=0             never check for a newer Bun release
rem
rem Needs curl.exe and tar.exe, which ship with Windows 10 (1803) and later. Downloads are verified against Bun's
rem SHASUMS256.txt. The latest release is checked at most once a day.

setlocal EnableExtensions EnableDelayedExpansion
set "ROOT=%~dp0.."
for %%I in ("%ROOT%") do set "ROOT=%%~fI"

if defined PFSF_BUN (
  endlocal & set "BUN=%PFSF_BUN%" & exit /b 0
)

set "RUNTIME=%ROOT%\.runtime\bun"
set "BUNEXE=%RUNTIME%\bun.exe"
if not exist "%RUNTIME%" mkdir "%RUNTIME%"

set "CHECK=1"
if "%PFSF_BUN_UPDATE%"=="0" set "CHECK=0"
if exist "%BUNEXE%" if exist "%RUNTIME%\.checked" (
  rem forfiles finds the stamp only when it is at least a day old.
  forfiles /p "%RUNTIME%" /m .checked /d -1 >nul 2>&1 || set "CHECK=0"
)
if "%CHECK%"=="0" if exist "%BUNEXE%" goto :done

where curl >nul 2>&1 || goto :no_tools
where tar >nul 2>&1 || goto :no_tools

set "TAG="
for /f "tokens=1,* delims= " %%A in ('curl -fsSI https://github.com/oven-sh/bun/releases/latest 2^>nul ^| findstr /i /b "location:"') do set "LOC=%%B"
if defined LOC (
  for %%T in ("!LOC:/=" "!") do set "TAG=%%~T"
)
if not "!TAG:~0,5!"=="bun-v" (
  if exist "%BUNEXE%" (
    echo Could not check for a newer Bun ^(offline?^); using the existing copy. 1>&2
    goto :done
  )
  echo error: could not determine the latest Bun release ^(are you online?^) 1>&2
  endlocal & exit /b 1
)
type nul > "%RUNTIME%\.checked"

set "CURRENT="
if exist "%BUNEXE%" for /f "delims=" %%V in ('"%BUNEXE%" --version 2^>nul') do set "CURRENT=bun-v%%V"
if "!CURRENT!"=="!TAG!" goto :done

set "ARCH=x64"
if /i "%PROCESSOR_ARCHITECTURE%"=="ARM64" set "ARCH=aarch64"
if /i "%PROCESSOR_ARCHITEW6432%"=="ARM64" set "ARCH=aarch64"

set "TMPDIR=%TEMP%\pfsf-bun-%RANDOM%%RANDOM%"
mkdir "%TMPDIR%"
set "BASE=https://github.com/oven-sh/bun/releases/download/!TAG!"
curl -fsSL --retry 2 -o "%TMPDIR%\SHASUMS256.txt" "!BASE!/SHASUMS256.txt" || goto :download_failed

call :install "bun-windows-%ARCH%"
if errorlevel 2 if "%ARCH%"=="x64" call :install "bun-windows-x64-baseline"
if errorlevel 1 goto :download_failed
rmdir /s /q "%TMPDIR%" >nul 2>&1
for /f "delims=" %%V in ('"%BUNEXE%" --version') do echo Using Bun %%V from %RUNTIME% 1>&2
goto :done

:install
set "TARGET=%~1"
echo Downloading %TARGET% (!TAG!)... 1>&2
curl -fsSL --retry 2 -o "%TMPDIR%\%TARGET%.zip" "!BASE!/%TARGET%.zip" || exit /b 1
set "EXPECTED="
for /f "tokens=1" %%H in ('findstr /c:" %TARGET%.zip" "%TMPDIR%\SHASUMS256.txt"') do set "EXPECTED=%%H"
set "ACTUAL="
for /f "skip=1 delims=" %%H in ('certutil -hashfile "%TMPDIR%\%TARGET%.zip" SHA256') do if not defined ACTUAL set "ACTUAL=%%H"
set "ACTUAL=!ACTUAL: =!"
if /i not "!EXPECTED!"=="!ACTUAL!" (
  echo error: checksum mismatch for %TARGET%.zip 1>&2
  exit /b 1
)
if exist "%TMPDIR%\x" rmdir /s /q "%TMPDIR%\x"
mkdir "%TMPDIR%\x"
tar -xf "%TMPDIR%\%TARGET%.zip" -C "%TMPDIR%\x" || exit /b 1
rem CPUs without AVX2 cannot run the default x64 build; exit code 2 makes the caller retry with -baseline.
"%TMPDIR%\x\%TARGET%\bun.exe" --version >nul 2>&1 || exit /b 2
move /y "%TMPDIR%\x\%TARGET%\bun.exe" "%BUNEXE%" >nul || exit /b 1
exit /b 0

:no_tools
if exist "%BUNEXE%" goto :done
echo error: curl.exe and tar.exe are required (Windows 10 1803 or later). 1>&2
endlocal & exit /b 1

:download_failed
if exist "%TMPDIR%" rmdir /s /q "%TMPDIR%" >nul 2>&1
if exist "%BUNEXE%" (
  echo warning: could not update Bun; using the existing copy. 1>&2
  goto :done
)
echo error: could not download Bun. 1>&2
endlocal & exit /b 1

:done
endlocal & set "BUN=%BUNEXE%"
exit /b 0
