@echo off
cd /d "%~dp0"

echo ===========================================
echo Starting ImageFlow Server...
echo ===========================================
echo.
echo The browser will open automatically.
echo To stop the server, press Ctrl+C or close this window.
echo.

start http://localhost:8000
node server.js %*

pause
