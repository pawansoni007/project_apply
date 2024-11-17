@echo off
:: Create logs directory
if not exist "%USERPROFILE%\job-alerts-logs" mkdir "%USERPROFILE%\job-alerts-logs"

:: Log start attempt
echo [%date% %time%] Starting Job Alerts API Server... >> "%USERPROFILE%\job-alerts-logs\startup.log"

:: Change to project directory
cd /d "C:\Users\chronic\Documents\projects\project_apply\project_apply_backend"

:: Log current directory
echo [%date% %time%] Current directory: %cd% >> "%USERPROFILE%\job-alerts-logs\startup.log"

:: Install dependencies if needed
if not exist "node_modules" (
    echo [%date% %time%] Installing dependencies... >> "%USERPROFILE%\job-alerts-logs\startup.log"
    call npm install >> "%USERPROFILE%\job-alerts-logs\startup.log" 2>&1
)

:: Check if PM2 is installed
call pm2 -v > nul 2>&1
if %errorlevel% neq 0 (
    echo [%date% %time%] Installing PM2... >> "%USERPROFILE%\job-alerts-logs\startup.log"
    call npm install -g pm2 >> "%USERPROFILE%\job-alerts-logs\startup.log" 2>&1
)

:: Start/Restart PM2 process
call pm2 describe job-alerts > nul 2>&1
if %errorlevel% neq 0 (
    echo [%date% %time%] Starting new PM2 process... >> "%USERPROFILE%\job-alerts-logs\startup.log"
    call pm2 start server.js --name job-alerts --max-restarts 10 --restart-delay 5000 >> "%USERPROFILE%\job-alerts-logs\startup.log" 2>&1
) else (
    echo [%date% %time%] Restarting existing PM2 process... >> "%USERPROFILE%\job-alerts-logs\startup.log"
    call pm2 restart job-alerts >> "%USERPROFILE%\job-alerts-logs\startup.log" 2>&1
)

:: Save PM2 process list
call pm2 save >> "%USERPROFILE%\job-alerts-logs\startup.log" 2>&1

:: Start the watchdog in background
start /B cmd /c "%~dp0watchdog.bat"

echo [%date% %time%] Startup script completed >> "%USERPROFILE%\job-alerts-logs\startup.log"