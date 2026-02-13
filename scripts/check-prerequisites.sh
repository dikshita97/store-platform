#!/bin/bash

# Prerequisites Verification Script for Store Provisioning Platform
# Run this to verify all required tools are installed

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Counters
PASSED=0
FAILED=0
WARNINGS=0

echo "=========================================="
echo "Prerequisites Verification"
echo "Store Provisioning Platform"
echo "=========================================="
echo ""

# Function to check version
check_version() {
    local cmd=$1
    local min_version=$2
    local name=$3
    
    if command -v $cmd &> /dev/null; then
        version=$($cmd --version 2>&1 | head -n1)
        echo -e "${GREEN}✓${NC} $name installed: $version"
        ((PASSED++))
        return 0
    else
        echo -e "${RED}✗${NC} $name NOT FOUND (minimum: $min_version)"
        ((FAILED++))
        return 1
    fi
}

# Function to check Docker is running
check_docker_running() {
    if command -v docker &> /dev/null; then
        if docker info &> /dev/null; then
            echo -e "${GREEN}✓${NC} Docker daemon is running"
            ((PASSED++))
        else
            echo -e "${RED}✗${NC} Docker is installed but NOT RUNNING"
            echo "   Start Docker Desktop (macOS/Windows) or run: sudo systemctl start docker (Linux)"
            ((FAILED++))
        fi
    fi
}

# Function to check kubectl can connect
check_kubectl_connection() {
    if command -v kubectl &> /dev/null; then
        if kubectl cluster-info &> /dev/null; then
            echo -e "${GREEN}✓${NC} kubectl can connect to cluster"
            context=$(kubectl config current-context 2>/dev/null || echo "none")
            echo "   Current context: $context"
            ((PASSED++))
        else
            echo -e "${YELLOW}⚠${NC} kubectl installed but not connected to cluster"
            echo "   This is OK - cluster will be created when running 'npm run k3d:up'"
            ((WARNINGS++))
        fi
    fi
}

# Function to check Node.js version
check_node_version() {
    if command -v node &> /dev/null; then
        version=$(node --version | sed 's/v//')
        major=$(echo $version | cut -d. -f1)
        
        if [ "$major" -ge 20 ]; then
            echo -e "${GREEN}✓${NC} Node.js v$version (>= 20.x required)"
            ((PASSED++))
        else
            echo -e "${YELLOW}⚠${NC} Node.js v$version found, but >= 20.x is recommended"
            ((WARNINGS++))
        fi
    fi
}

# Main checks
echo "Checking installed tools..."
echo ""

# 1. Docker
echo -e "${BLUE}Docker Runtime${NC}"
check_version "docker" "24.0" "Docker"
check_docker_running
echo ""

# 2. Kubernetes tools
echo -e "${BLUE}Kubernetes Tools${NC}"
check_version "kubectl" "1.28" "kubectl"
check_kubectl_connection
check_version "helm" "3.13" "Helm"
check_version "k3d" "5.6" "k3d"
echo ""

# 3. Node.js
echo -e "${BLUE}Node.js Runtime${NC}"
check_node_version
check_version "npm" "10.0" "npm"
echo ""

# 4. Optional tools
echo -e "${BLUE}Optional Tools${NC}"
if command -v jq &> /dev/null; then
    echo -e "${GREEN}✓${NC} jq installed"
    ((PASSED++))
else
    echo -e "${YELLOW}⚠${NC} jq NOT FOUND (optional, but recommended for API testing)"
    ((WARNINGS++))
fi

if command -v git &> /dev/null; then
    echo -e "${GREEN}✓${NC} git installed"
    ((PASSED++))
else
    echo -e "${YELLOW}⚠${NC} git NOT FOUND (optional)"
    ((WARNINGS++))
fi
echo ""

# Summary
echo "=========================================="
echo "Summary"
echo "=========================================="
echo -e "${GREEN}✓ Passed: $PASSED${NC}"
echo -e "${YELLOW}⚠ Warnings: $WARNINGS${NC}"
echo -e "${RED}✗ Failed: $FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}All required tools are installed!${NC}"
    echo ""
    echo "Next steps:"
    echo "1. cd store-platform"
    echo "2. npm run k3d:up"
    echo "3. npm run install:platform"
    echo "4. kubectl port-forward svc/dashboard 5173:80 -n store-platform"
    echo "5. open http://localhost:5173"
    exit 0
else
    echo -e "${RED}Some required tools are missing!${NC}"
    echo ""
    echo "Please install missing tools:"
    echo "See: docs/PREREQUISITES_INSTALLATION.md"
    echo ""
    echo "Or run the automated installer:"
    echo "./docs/install-prereqs.sh"
    exit 1
fi
