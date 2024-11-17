@echo off
:: Create logs directory
if not exist "%USERPROFILE%\job-alerts-logs" mkdir "%USERPROFILE%\job-alerts-logs"

echo [%date% %time%] Watchdog started >> "%USERPROFILE%\job-alerts-logs\watchdog.log"

:check_process
:: Get current timestamp
set "timestamp=%date% %time%"

:: Check PM2 status
call pm2 pid job-alerts > nul 2>&1
if %errorlevel% neq 0 (
    echo [%timestamp%] PM2 process not found. Restarting... >> "%USERPROFILE%\job-alerts-logs\watchdog.log"
    cd /d "C:\Users\chronic\Documents\projects\project_apply\project_apply_backend"
    call pm2 start server.js --name job-alerts >> "%USERPROFILE%\job-alerts-logs\watchdog.log" 2>&1
    timeout /t 30 /nobreak > nul
)

:: Check if server is responding
curl -s -f http://localhost:4000/health > nul 2>&1
if %errorlevel% neq 0 (
    echo [%timestamp%] Health check failed. Restarting... >> "%USERPROFILE%\job-alerts-logs\watchdog.log"
    call pm2 restart job-alerts >> "%USERPROFILE%\job-alerts-logs\watchdog.log" 2>&1
)

:: Wait before next check
timeout /t 60 /nobreak > nul
goto check_process