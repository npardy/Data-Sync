@echo off
echo ========================================
echo Installing archiver package for ZIP functionality
echo ========================================
echo.

REM Try to change to the network path
echo Attempting to access network path...
pushd "\\PS-NAS\Pardy Surveys\Data Sync\trimble-sync" 2>nul

if %errorlevel% neq 0 (
    echo ERROR: Could not access the network path
    echo Please make sure you have access to: \\PS-NAS\Pardy Surveys\Data Sync\trimble-sync
    echo.
    echo Alternative: Run these commands manually in PowerShell:
    echo   cd "\\PS-NAS\Pardy Surveys\Data Sync\trimble-sync"
    echo   npm install archiver
    echo.
    pause
    exit /b 1
)

echo Successfully accessed network path
echo Current directory: %CD%
echo.

REM Check if npm is installed
where npm >nul 2>nul
if %errorlevel% neq 0 (
    echo ERROR: npm is not installed or not in PATH
    echo Please install Node.js first
    echo.
    pause
    exit /b 1
)

echo Installing archiver package...
echo Running: npm install archiver
echo.

npm install archiver

if %errorlevel% neq 0 (
    echo.
    echo ERROR: Failed to install archiver package
    echo Please check the error message above
) else (
    echo.
    echo ========================================
    echo SUCCESS! Archiver package installed
    echo ========================================
    echo.
    echo Please restart your Data Sync server for the changes to take effect
)

REM Return to previous directory
popd

echo.
echo Press any key to close this window...
pause >nul
