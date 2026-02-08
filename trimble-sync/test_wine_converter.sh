#!/bin/bash
echo "=== Testing Wine and .NET Setup ==="

# Start Xvfb if not running
if ! pgrep -x "Xvfb" > /dev/null; then
    echo "Starting Xvfb..."
    Xvfb :0 -screen 0 1024x768x16 &
    sleep 2
fi

echo "1. Wine version:"
wine --version

echo -e "\n2. Checking .NET installation:"
wine reg query "HKLM\\Software\\Microsoft\\NET Framework Setup\\NDP" 2>&1 | grep -E "Version|Install" | head -20

echo -e "\n3. Testing converter:"
cd /app/trimble-converter/JobConversion
wine TrimbleAccess.JobConverter.ConverterProcess.exe --help 2>&1 | grep -v "wine:" | head -20

echo -e "\n4. Checking if converter can be executed:"
file TrimbleAccess.JobConverter.ConverterProcess.exe
ls -la TrimbleAccess.JobConverter.ConverterProcess.exe

echo -e "\n5. Testing with a simple conversion:"
if [ -f /app/trimble-converter/test.jxl ]; then
    echo "Found test.jxl, attempting conversion..."
    wine TrimbleAccess.JobConverter.ConverterProcess.exe \
        --command=jxl-to-job \
        --inPath=/app/trimble-converter/test.jxl \
        --outPath=/tmp/test.job \
        --convertersPath=/app/trimble-converter/JobConversion \
        --geodataPath=/app/trimble-converter/geodata 2>&1
    
    if [ -f /tmp/test.job ]; then
        echo "SUCCESS! JOB file created:"
        ls -la /tmp/test.job
    else
        echo "No JOB file created"
    fi
else
    echo "No test.jxl file found"
fi