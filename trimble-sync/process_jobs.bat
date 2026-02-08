@echo off
echo ========================================
echo  Trimble Job File Processor
echo ========================================
echo.

cd /d "Z:\Data Sync\trimble-sync"
python process_pending_jobs.py

echo.
pause