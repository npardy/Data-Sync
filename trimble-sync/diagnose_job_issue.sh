#!/bin/bash
# Diagnostic script to run inside the Docker container

echo "=== Trimble Sync JOB File Generation Diagnostics ==="
echo

echo "1. Checking Python installation:"
python3 --version
echo

echo "2. Checking Wine installation:"
wine --version
echo

echo "3. Checking if JXL generator script exists:"
ls -la /app/trimble-converter/jxl_generator.py
echo

echo "4. Checking if Trimble converter exists:"
ls -la /app/trimble-converter/JobConversion/TrimbleAccess.JobConverter.ConverterProcess.exe
echo

echo "5. Testing Wine with converter (help command):"
cd /app/trimble-converter/JobConversion
wine TrimbleAccess.JobConverter.ConverterProcess.exe --help 2>&1 | grep -v "wine:"
echo

echo "6. Checking for .NET Framework in Wine:"
wine reg query "HKLM\Software\Microsoft\NET Framework Setup\NDP" 2>&1 | grep -v "wine:"
echo

echo "7. Checking Wine prefix:"
ls -la ~/.wine/drive_c/windows/Microsoft.NET/
echo

echo "8. Testing Python JXL generation:"
cd /app
python3 /app/trimble-converter/jxl_generator.py --help
echo

echo "=== End of diagnostics ==="