# Prerequisites Installation Guide

Complete installation instructions for all tools required to run the Store Provisioning Platform.

## Required Tools

| Tool | Minimum Version | Purpose |
|------|----------------|---------|
| Docker Desktop | 4.25+ | Container runtime |
| kubectl | 1.28+ | Kubernetes CLI |
| Helm | 3.13+ | Kubernetes package manager |
| k3d | 5.6+ | Local Kubernetes (k3s) |
| Node.js | 20.x | JavaScript runtime |
| npm | 10.x | Package manager |

---

## 1. Docker Desktop

### macOS

**Option A: Download (Easiest)**
1. Visit: https://www.docker.com/products/docker-desktop
2. Download Docker Desktop for Mac (Apple Silicon or Intel)
3. Open `.dmg` file and drag Docker to Applications
4. Launch Docker Desktop from Applications
5. Wait for "Docker Desktop is running" message

**Option B: Homebrew**
```bash
# Install Homebrew first if not installed
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install Docker Desktop
brew install --cask docker

# Start Docker Desktop
open /Applications/Docker.app
```

**Verify Installation:**
```bash
docker --version
# Expected: Docker version 24.x.x or higher
docker run hello-world
```

### Linux (Ubuntu/Debian)

```bash
# Update package index
sudo apt-get update

# Install required packages
sudo apt-get install -y \
    apt-transport-https \
    ca-certificates \
    curl \
    gnupg \
    lsb-release

# Add Docker's official GPG key
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | \
    sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg

# Set up stable repository
echo \
    "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] \
    https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | \
    sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Update and install Docker
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Add user to docker group (logout/login required after)
sudo usermod -aG docker $USER
newgrp docker

# Verify
docker --version
docker run hello-world
```

### Windows (WSL2)

**Step 1: Install WSL2**
```powershell
# Open PowerShell as Administrator
wsl --install

# Restart computer when prompted
# Set WSL default version to 2
wsl --set-default-version 2
```

**Step 2: Install Docker Desktop**
1. Download from: https://www.docker.com/products/docker-desktop
2. Run installer
3. During setup:
   - ✅ Use WSL2 instead of Hyper-V (recommended)
   - ✅ Install required Windows components for WSL2
4. Restart computer
5. Open Docker Desktop
6. Go to Settings → Resources → WSL Integration
7. ✅ Enable integration with your default WSL distro

**Step 3: Verify in WSL2**
```bash
# Open WSL2 terminal
wsl

# Verify Docker works
docker --version
docker run hello-world
```

---

## 2. kubectl (Kubernetes CLI)

### macOS

```bash
# Using Homebrew
brew install kubectl

# Using curl
curl -LO "https://dl.k8s/release/$(curl -L -s https://dl.k8s/release/stable.txt)/bin/darwin/amd64/kubectl"
chmod +x kubectl
sudo mv kubectl /usr/local/bin/

# Verify
kubectl version --client
```

### Linux

```bash
# Download latest release
curl -LO "https://dl.k8s/release/$(curl -L -s https://dl.k8s/release/stable.txt)/bin/linux/amd64/kubectl"

# Install
sudo install -o root -g root -m 0755 kubectl /usr/local/bin/kubectl

# Or if you don't have root access
chmod +x kubectl
mkdir -p ~/.local/bin
mv kubectl ~/.local/bin/
# Add to PATH: export PATH="$HOME/.local/bin:$PATH"

# Verify
kubectl version --client
```

### Windows

```powershell
# Using PowerShell
curl.exe -LO "https://dl.k8s.io/release/v1.28.0/bin/windows/amd64/kubectl.exe"

# Create directory
New-Item -ItemType Directory -Force -Path "$HOME\bin"

# Move kubectl
Move-Item -Path .\kubectl.exe -Destination "$HOME\bin\kubectl.exe"

# Add to PATH
[Environment]::SetEnvironmentVariable("Path", $env:Path + ";$HOME\bin", "User")

# Verify in new PowerShell window
kubectl version --client
```

**Alternative: Using Chocolatey**
```powershell
choco install kubernetes-cli
```

---

## 3. Helm

### macOS

```bash
# Using Homebrew
brew install helm

# Using official installer
curl -fsSL -o get_helm.sh https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3
chmod 700 get_helm.sh
./get_helm.sh

# Verify
helm version
```

### Linux

```bash
# Download
curl -fsSL -o get_helm.sh https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3
chmod 700 get_helm.sh
./get_helm.sh

# Or using apt (if available)
curl https://baltocdn.com/helm/signing.asc | gpg --dearmor | sudo tee /usr/share/keyrings/helm.gpg > /dev/null
sudo apt-get install apt-transport-https --yes
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/helm.gpg] https://baltocdn.com/helm/stable/debian/ all main" | sudo tee /etc/apt/sources.list.d/helm-stable-debian.list
sudo apt-get update
sudo apt-get install helm

# Verify
helm version
```

### Windows

```powershell
# Using Chocolatey
choco install kubernetes-helm

# Or using Scoop
scoop install helm

# Verify
helm version
```

---

## 4. k3d (Lightweight Kubernetes)

### macOS

```bash
# Using Homebrew
brew install k3d

# Using curl
wget -q -O - https://raw.githubusercontent.com/k3d-io/k3d/main/install.sh | bash

# Verify
k3d version
```

### Linux

```bash
# Install via script
wget -q -O - https://raw.githubusercontent.com/k3d-io/k3d/main/install.sh | bash

# Or download specific version
curl -s https://api.github.com/repos/k3d-io/k3d/releases/latest | \
    grep browser_download_url | \
    grep linux-amd64 | \
    cut -d '"' -f 4 | \
    wget -qi -
chmod +x k3d-linux-amd64
sudo mv k3d-linux-amd64 /usr/local/bin/k3d

# Verify
k3d version
```

### Windows

```powershell
# Using Chocolatey
choco install k3d

# Using Scoop
scoop install k3d

# Or download manually
# Visit: https://github.com/k3d-io/k3d/releases
# Download k3d-windows-amd64.exe
# Rename to k3d.exe and add to PATH

# Verify
k3d version
```

---

## 5. Node.js & npm

### macOS

```bash
# Using Homebrew (Recommended)
brew install node@20

# Using nvm (Node Version Manager - Recommended for developers)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
# Restart terminal or run: source ~/.bashrc or source ~/.zshrc
nvm install 20
nvm use 20
nvm alias default 20

# Verify
node --version
npm --version
```

### Linux

```bash
# Using NodeSource (Recommended)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Or using nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
nvm install 20
nvm use 20

# Verify
node --version
npm --version
```

### Windows

```powershell
# Using Chocolatey
choco install nodejs --version=20.10.0

# Using Scoop
scoop install nodejs

# Or download installer
# Visit: https://nodejs.org/
# Download LTS version (v20.x.x)
# Run installer

# Verify in PowerShell
node --version
npm --version
```

---

## 6. Optional: jq (JSON Processor)

Useful for parsing API responses.

### macOS
```bash
brew install jq
```

### Linux
```bash
sudo apt-get install jq
```

### Windows
```powershell
choco install jq
```

---

## 7. Verify All Installations

Run this script to check everything:

```bash
#!/bin/bash

echo "=== Checking Prerequisites ==="
echo ""

echo "1. Docker:"
docker --version || echo "❌ Docker not found"
echo ""

echo "2. kubectl:"
kubectl version --client || echo "❌ kubectl not found"
echo ""

echo "3. Helm:"
helm version --short || echo "❌ Helm not found"
echo ""

echo "4. k3d:"
k3d version || echo "❌ k3d not found"
echo ""

echo "5. Node.js:"
node --version || echo "❌ Node.js not found"
echo ""

echo "6. npm:"
npm --version || echo "❌ npm not found"
echo ""

echo "7. jq (optional):"
jq --version || echo "⚠️ jq not found (optional)"
echo ""

echo "=== Verification Complete ==="
```

Save as `check-prereqs.sh` and run:
```bash
chmod +x check-prereqs.sh
./check-prereqs.sh
```

---

## Troubleshooting

### Docker Issues

**Problem:** `docker: Cannot connect to the Docker daemon`

**Solution:**
```bash
# macOS
# Ensure Docker Desktop is running
open -a Docker

# Linux
sudo systemctl start docker
sudo systemctl enable docker
sudo usermod -aG docker $USER
# Logout and login again

# Windows
# Ensure Docker Desktop is running
# Check WSL2 integration is enabled in Docker Desktop settings
```

### kubectl Issues

**Problem:** `kubectl: command not found`

**Solution:**
```bash
# Add to PATH if not found
export PATH="$PATH:/usr/local/bin"

# Or check if installed
which kubectl
```

### k3d Issues

**Problem:** `k3d: command not found` (Linux)

**Solution:**
```bash
# If installed but not in PATH
export PATH="$PATH:$HOME/.local/bin"

# Or move to standard location
sudo mv ~/k3d /usr/local/bin/
```

### Node.js Issues

**Problem:** Wrong Node version installed

**Solution:**
```bash
# Using nvm
nvm install 20
nvm use 20
nvm alias default 20

# Verify
node --version  # Should show v20.x.x
```

### Permission Issues (Linux)

**Problem:** Permission denied when running docker

**Solution:**
```bash
# Add user to docker group
sudo usermod -aG docker $USER
newgrp docker

# Or use sudo (not recommended for development)
sudo docker ps
```

---

## Quick Install Script (Linux/macOS)

Save as `install-prereqs.sh`:

```bash
#!/bin/bash

set -e

echo "=== Installing Prerequisites for Store Provisioning Platform ==="

# Detect OS
OS="$(uname -s)"

case "$OS" in
    Linux*)
        if command -v apt-get &> /dev/null; then
            echo "Detected: Ubuntu/Debian"
            
            # Update
            sudo apt-get update
            
            # Install Docker
            sudo apt-get install -y apt-transport-https ca-certificates curl gnupg lsb-release
            curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
            echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
            sudo apt-get update
            sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
            sudo usermod -aG docker $USER
            
            # Install kubectl
            curl -LO "https://dl.k8s/release/$(curl -L -s https://dl.k8s/release/stable.txt)/bin/linux/amd64/kubectl"
            sudo install -o root -g root -m 0755 kubectl /usr/local/bin/kubectl
            rm kubectl
            
            # Install Helm
            curl -fsSL -o get_helm.sh https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3
            chmod 700 get_helm.sh
            ./get_helm.sh
            rm get_helm.sh
            
            # Install Node.js
            curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
            sudo apt-get install -y nodejs
            
            # Install jq
            sudo apt-get install -y jq
            
        elif command -v brew &> /dev/null; then
            echo "Detected: Linux with Homebrew"
            brew install docker kubectl helm k3d node@20 jq
        fi
        ;;
        
    Darwin*)
        echo "Detected: macOS"
        
        # Check if Homebrew installed
        if ! command -v brew &> /dev/null; then
            echo "Installing Homebrew..."
            /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
        fi
        
        # Install all tools
        brew install docker kubectl helm k3d node@20 jq
        
        echo "Note: Docker Desktop must be downloaded manually from docker.com"
        ;;
        
    *)
        echo "Unsupported OS: $OS"
        exit 1
        ;;
esac

# Install k3d
wget -q -O - https://raw.githubusercontent.com/k3d-io/k3d/main/install.sh | bash

echo ""
echo "=== Installation Complete ==="
echo ""
echo "Verifying installations..."
docker --version
kubectl version --client
helm version --short
k3d version
node --version
npm --version

echo ""
echo "⚠️  IMPORTANT: Please logout and login again for Docker group changes to take effect"
echo ""
echo "Next steps:"
echo "1. Start Docker Desktop (if on macOS or Windows)"
echo "2. Run: npm run k3d:up"
echo "3. Run: npm run install:platform"
```

**Run the script:**
```bash
chmod +x install-prereqs.sh
./install-prereqs.sh
```

---

**Need Help?**

- Docker: https://docs.docker.com/get-docker/
- kubectl: https://kubernetes.io/docs/tasks/tools/
- Helm: https://helm.sh/docs/intro/install/
- k3d: https://k3d.io/v5.6.0/#installation
- Node.js: https://nodejs.org/en/download/

After installation, see `QUICKSTART.md` for running the platform!
