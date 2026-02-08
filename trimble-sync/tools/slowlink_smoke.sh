#!/bin/bash

###############################################################################
# Slowlink Smoke Test for Upload Resilience
# Simulates 1 Mbps bandwidth + 500ms RTT + 1% packet loss using Linux tc
#
# Usage:
#   sudo ./slowlink_smoke.sh [interface]
#
# Example:
#   sudo ./slowlink_smoke.sh eth0
#   sudo ./slowlink_smoke.sh wlan0
#
# Requirements:
#   - Linux with tc (traffic control)
#   - Root/sudo access
#   - Node.js installed
###############################################################################

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
INTERFACE="${1:-eth0}"
RATE="1mbit"
LATENCY="250ms"  # 250ms each way = 500ms RTT
LOSS="1%"

# Detect if running on macOS
if [[ "$OSTYPE" == "darwin"* ]]; then
  echo -e "${RED}❌ This script requires Linux with tc (traffic control)${NC}"
  echo -e "${YELLOW}ℹ  macOS alternative: Use Network Link Conditioner (Xcode Tools)${NC}"
  echo -e "${YELLOW}   or use a Linux VM for accurate testing.${NC}"
  exit 1
fi

# Check for root
if [[ $EUID -ne 0 ]]; then
  echo -e "${RED}❌ This script must be run as root${NC}"
  echo -e "${YELLOW}   Run with: sudo $0 $@${NC}"
  exit 1
fi

# Check for tc command
if ! command -v tc &> /dev/null; then
  echo -e "${RED}❌ tc (traffic control) command not found${NC}"
  echo -e "${YELLOW}   Install with: apt install iproute2 (Debian/Ubuntu)${NC}"
  echo -e "${YELLOW}                 yum install iproute (RedHat/CentOS)${NC}"
  exit 1
fi

# Check for node
if ! command -v node &> /dev/null; then
  echo -e "${RED}❌ node command not found${NC}"
  echo -e "${YELLOW}   Install Node.js to run smoke tests${NC}"
  exit 1
fi

echo -e "${CYAN}=============================================${NC}"
echo -e "${CYAN}  SLOWLINK SMOKE TEST${NC}"
echo -e "${CYAN}=============================================${NC}"
echo ""
echo -e "${CYAN}Interface:${NC} $INTERFACE"
echo -e "${CYAN}Rate:${NC}      $RATE (1 Mbps)"
echo -e "${CYAN}Latency:${NC}   $LATENCY each way (500ms RTT total)"
echo -e "${CYAN}Loss:${NC}      $LOSS"
echo ""

# Function to cleanup on exit
cleanup() {
  echo ""
  echo -e "${YELLOW}⏳ Removing traffic control rules...${NC}"

  # Delete root qdisc (cleans up everything)
  tc qdisc del dev "$INTERFACE" root 2>/dev/null || true

  echo -e "${GREEN}✓ Traffic control rules removed${NC}"
  echo ""
}

# Register cleanup on script exit
trap cleanup EXIT INT TERM

# Apply traffic shaping
echo -e "${YELLOW}⏳ Applying traffic control rules...${NC}"

# Remove any existing qdiscs
tc qdisc del dev "$INTERFACE" root 2>/dev/null || true

# Add HTB (Hierarchical Token Bucket) qdisc for rate limiting
tc qdisc add dev "$INTERFACE" root handle 1: htb default 12

# Create a class with rate limit
tc class add dev "$INTERFACE" parent 1: classid 1:12 htb rate "$RATE" ceil "$RATE"

# Add netem qdisc for latency and packet loss
tc qdisc add dev "$INTERFACE" parent 1:12 handle 10: netem delay "$LATENCY" loss "$LOSS"

echo -e "${GREEN}✓ Traffic control rules applied${NC}"
echo ""

# Show current settings
echo -e "${CYAN}Current tc settings:${NC}"
tc qdisc show dev "$INTERFACE"
echo ""

# Wait a moment for rules to take effect
sleep 1

# Run the smoke tests
echo -e "${CYAN}=============================================${NC}"
echo -e "${CYAN}  RUNNING UPLOAD SMOKE TESTS${NC}"
echo -e "${CYAN}=============================================${NC}"
echo ""

# Set script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Check if upload-smoke.js exists
if [[ ! -f "$SCRIPT_DIR/upload-smoke.js" ]]; then
  echo -e "${RED}❌ upload-smoke.js not found in $SCRIPT_DIR${NC}"
  exit 1
fi

# Run smoke tests
if node "$SCRIPT_DIR/upload-smoke.js"; then
  SMOKE_EXIT=0
  echo -e "${GREEN}✅ Smoke tests PASSED under slow link conditions${NC}"
else
  SMOKE_EXIT=$?
  echo -e "${RED}❌ Smoke tests FAILED${NC}"
fi

# Check sync-activity.log
echo ""
echo -e "${CYAN}=============================================${NC}"
echo -e "${CYAN}  CHECKING SYNC ACTIVITY LOG${NC}"
echo -e "${CYAN}=============================================${NC}"
echo ""

LOG_FILE="$SCRIPT_DIR/../sync-activity.log"

if [[ -f "$LOG_FILE" ]]; then
  echo -e "${YELLOW}Recent log entries:${NC}"
  echo ""
  tail -20 "$LOG_FILE"
  echo ""

  # Check for required log entries
  echo -e "${CYAN}Verifying log entries...${NC}"

  if grep -q "Upload started" "$LOG_FILE"; then
    echo -e "${GREEN}✓ Found 'Upload started' entries${NC}"
  else
    echo -e "${RED}✗ Missing 'Upload started' entries${NC}"
    SMOKE_EXIT=1
  fi

  if grep -q "File uploaded" "$LOG_FILE"; then
    echo -e "${GREEN}✓ Found 'File uploaded' entries${NC}"
  else
    echo -e "${RED}✗ Missing 'File uploaded' entries${NC}"
    SMOKE_EXIT=1
  fi

  if grep -q "Upload completed" "$LOG_FILE"; then
    echo -e "${GREEN}✓ Found 'Upload completed' entries${NC}"
  else
    echo -e "${RED}✗ Missing 'Upload completed' entries${NC}"
    SMOKE_EXIT=1
  fi
else
  echo -e "${YELLOW}⚠  Log file not found: $LOG_FILE${NC}"
fi

# Final summary
echo ""
echo -e "${CYAN}=============================================${NC}"
echo -e "${CYAN}  TEST COMPLETE${NC}"
echo -e "${CYAN}=============================================${NC}"
echo ""

if [[ $SMOKE_EXIT -eq 0 ]]; then
  echo -e "${GREEN}✅ All checks passed under slow link conditions${NC}"
  echo -e "${GREEN}   Uploads are resilient to 1 Mbps + 500ms RTT + 1% loss${NC}"
else
  echo -e "${RED}❌ Tests failed or incomplete${NC}"
  echo -e "${YELLOW}   Review logs above for details${NC}"
fi

echo ""

# cleanup() will run automatically via trap
exit $SMOKE_EXIT
