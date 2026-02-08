#!/bin/sh
# Trimble Sync Server - Initialization Script

echo "Trimble Sync Server - First Time Setup"
echo "======================================"

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
else
    echo "Dependencies already installed."
fi

# Create required directories
echo "Creating data directories..."
mkdir -p /data/office
mkdir -p /data/controller
mkdir -p /data/templates

# Check for template files
echo "Checking for template files..."
if [ ! -f "/data/templates/TMNT Z1.jxl" ]; then
    echo "WARNING: TMNT Z1.jxl not found in templates folder"
    echo "Please upload your JXL template to: /data/templates/"
fi

if [ ! -f "/data/templates/Control Avalon 241007.csv" ]; then
    echo "WARNING: Control file not found in templates folder"
    echo "Please upload your control file to: /data/templates/"
fi

echo ""
echo "Starting server..."
echo "Local access: http://localhost:3000"
echo ""

# Start the server
npm start