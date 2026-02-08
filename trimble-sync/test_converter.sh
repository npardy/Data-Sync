#!/bin/bash
# Test script to verify converter functionality inside Docker container

echo "=== Testing Trimble Converter Setup ==="
echo

cd /app/trimble-converter/JobConversion

echo "1. Checking converter executable:"
ls -la TrimbleAccess.JobConverter.ConverterProcess.exe
echo

echo "2. Checking required DLL files:"
ls -la *.dll
echo

echo "3. Checking configuration:"
cat TrimbleAccess.JobConverter.ConverterProcess.exe.config
echo

echo "4. Testing converter with Wine (help command):"
wine TrimbleAccess.JobConverter.ConverterProcess.exe --help 2>&1 | grep -v "wine:" | head -20
echo

echo "5. Checking Wine .NET installation:"
wine reg query "HKLM\\Software\\Microsoft\\NET Framework Setup\\NDP\\v4\\Full" /v Version 2>&1 | grep -v "wine:"
echo

echo "6. Testing JXL to JOB conversion with test file:"
if [ -f ../test.jxl ]; then
    wine TrimbleAccess.JobConverter.ConverterProcess.exe \
        --command=jxl-to-job \
        --inPath=/app/trimble-converter/test.jxl \
        --outPath=/app/trimble-converter/test_output.job \
        --convertersPath=/app/trimble-converter/JobConversion \
        --geodataPath=/app/trimble-converter/geodata 2>&1 | grep -v "wine:"
    
    if [ -f /app/trimble-converter/test_output.job ]; then
        echo "SUCCESS: Test JOB file created!"
        ls -la /app/trimble-converter/test_output.job
    else
        echo "FAILED: No JOB file created"
    fi
else
    echo "No test.jxl file found"
fi

echo
echo "=== Test Complete ==="