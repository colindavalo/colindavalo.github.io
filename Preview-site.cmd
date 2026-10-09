@echo off
cd /d "%~dp0"
where py >nul 2>nul
if errorlevel 1 (
  python scripts\preview_site.py %*
) else (
  py -3 scripts\preview_site.py %*
)
if errorlevel 1 pause
