@echo off
echo Starting Windows JOB Converter Service...
echo.
echo This service allows your NAS to convert JXL to JOB files
echo using your Windows machine.
echo.
echo Installing Flask if needed...
pip install flask

echo.
echo Starting service on port 5000...
python windows_job_converter_service.py

pause