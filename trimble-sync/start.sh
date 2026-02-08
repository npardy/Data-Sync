#!/bin/sh
cd /app
echo "Starting Trimble Sync Server..."
echo "Installing dependencies..."
npm install
echo "Starting server..."
exec npm start