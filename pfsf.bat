@echo off
rem Command-line interface: render infographics without the browser UI.
rem   pfsf.bat --help
rem   pfsf.bat --game pf2e --layout booklet --format pdf
rem   pfsf.bat fetch-art
setlocal
call "%~dp0scripts\ensure-bun.bat" || exit /b 1
if not exist "%~dp0node_modules" (
  pushd "%~dp0"
  "%BUN%" install --frozen-lockfile 1>&2 || (popd & exit /b 1)
  popd
)
"%BUN%" "%~dp0packages\cli\src\main.ts" %*
