#!/bin/bash
echo "Installing .NET Framework 4.7.2 in Wine..."
echo "This will take 10-15 minutes..."

# Download winetricks if not present
if [ ! -f /usr/local/bin/winetricks ]; then
    echo "Downloading winetricks..."
    wget -q https://raw.githubusercontent.com/Winetricks/winetricks/master/src/winetricks
    chmod +x winetricks
    mv winetricks /usr/local/bin/
fi

# Set display for GUI components
export DISPLAY=:99
Xvfb :99 -screen 0 1024x768x16 &
sleep 2

# Install .NET Framework 4.7.2
echo "Installing .NET Framework 4.7.2..."
winetricks -q dotnet472

# Also install Visual C++ redistributables that might be needed
echo "Installing Visual C++ redistributables..."
winetricks -q vcrun2019

# Kill virtual display
killall Xvfb

echo "Installation complete!"
echo "Testing converter..."
cd /app/trimble-converter/JobConversion
wine TrimbleAccess.JobConverter.ConverterProcess.exe --help