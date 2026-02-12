#!/bin/bash

# Ant Media Server Installation Script
# This script downloads and installs Ant Media Server with license key

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   print_error "This script must be run as root (use sudo)"
   exit 1
fi

print_status "Starting Ant Media Server installation..."

# Download installation script
print_status "Downloading Ant Media Server installation script..."
wget -O install_ant-media-server.sh https://raw.githubusercontent.com/ant-media/Scripts/master/install_ant-media-server.sh

# Make script executable
print_status "Making installation script executable..."
chmod 755 install_ant-media-server.sh

# Set license key
LICENSE_KEY="AMS94f7caac627e314b6b03f0fae35f20"

# Run installation with license key
print_status "Running Ant Media Server installation with license key..."
# Run in non-interactive mode and ignore systemd errors
./install_ant-media-server.sh -l "$LICENSE_KEY" || true

# Wait for installation to complete
print_status "Waiting for installation to complete..."
sleep 5

# Add JWT configuration to red5.properties
CONFIG_FILE="/usr/local/antmedia/conf/red5.properties"

if [ -f "$CONFIG_FILE" ]; then
    print_status "Adding JWT configuration to red5.properties..."
    
    # Backup original file
    cp "$CONFIG_FILE" "$CONFIG_FILE.backup"
    
    # Add JWT configuration at the end of the file
    echo "" >> "$CONFIG_FILE"
    echo "# added automatically by ando" >> "$CONFIG_FILE"
    echo "server.jwtServerControlEnabled=true" >> "$CONFIG_FILE"
    echo "server.jwtServerSecretKey=your-secret-key-at-least-32-character" >> "$CONFIG_FILE"
    
    print_status "JWT configuration added successfully"
else
    print_error "Configuration file not found: $CONFIG_FILE"
    exit 1
fi

print_status "Ant Media Server installation completed!"
print_status "JWT configuration has been added to enable server control."
print_warning "Please restart Ant Media Server service to apply the new configuration:"
print_warning "sudo systemctl restart antmedia"
print_warning ""
print_status "Default web interface: http://localhost:5080"
print_status "Default SSL interface: https://localhost:5443"