@echo off
rem Starts the infographic generator locally and opens it in your default browser.
rem Uses a project-local copy of the latest stable Bun (downloaded into .runtime\ on first run).
rem
rem   start.bat              start and open the browser
rem   start.bat --no-open    start without opening a browser
rem   start.bat --port 8080  use a specific port
setlocal
call "%~dp0scripts\ensure-bun.bat" || exit /b 1
"%BUN%" "%~dp0tools\launch.ts" %*
