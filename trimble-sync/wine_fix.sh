#!/bin/bash
# Script to fix Wine .NET issues in the running container

echo "Installing .NET Framework in Wine..."
cd /tmp

# Download and install .NET Framework 4.8
echo "Downloading .NET Framework installer..."
wget -q https://download.microsoft.com/download/e/2/1/e21644e5-5d84-4d4e-b01b-07eb4f6f4e77/NDP48-x86-x64-AllOS-ENU.exe

# Install with Wine
echo "Installing .NET Framework 4.8..."
wine NDP48-x86-x64-AllOS-ENU.exe /quiet /norestart

# Also try installing Visual C++ Redistributables which might be needed
echo "Installing Visual C++ Redistributables..."
winetricks -q vcrun2019

echo "Wine .NET installation attempt complete."
echo "Testing converter..."
cd /app/trimble-converter/JobConversion
wine TrimbleAccess.JobConverter.ConverterProcess.exe --help

echo "Done. Try creating a job file now."