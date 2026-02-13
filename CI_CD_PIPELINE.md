# CI/CD Pipeline

## Overview

The CI/CD pipeline automates the build, test, and deployment processes for the Store Provisioning Platform. The pipeline uses GitHub Actions for CI and supports both local (k3d/kind) and production (k3s) environments.

## Pipeline Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Developer Push                          │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                     CI Pipeline                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐    │
│  │  Lint    │─▶│  Build   │─▶│  Test    │─▶│ Package  │    │
│  │          │  │          │  │          │  │          │    │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘    │
└──────────────────────┬──────────────────────────────────────┘
                       │ Artifacts
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                     CD Pipeline                              │
│  ┌────────────────┐        ┌────────────────┐              │
│  │  Deploy Local  │───────▶│   E2E Tests    │              │
│  │   (k3d/kind)   │        │   (Automated)  │              │
│  └────────────────┘        └────────┬───────┘              │
│                                     │ Pass                 │
│                                     ▼                      │
│                          ┌────────────────┐                │
│                          │ Deploy Prod    │                │
│                          │   (Manual)     │                │
│                          └────────────────┘                │
└─────────────────────────────────────────────────────────────┘
```

## CI Pipeline

### Stages

#### 1. Lint & Static Analysis

**Tools:**
- **ESLint:** JavaScript/TypeScript linting
- **Helm Lint:** Chart validation
- **ShellCheck:** Shell script validation
- **Hadolint:** Dockerfile linting
- **Yamllint:** YAML file validation

**Workflow Steps:**
```yaml
lint:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    
    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '20'
    
    - name: Install dependencies
      run: |
        npm ci
        cd dashboard && npm ci
        cd ../provisioner && npm ci
    
    - name: Lint JavaScript/TypeScript
      run: |
        npm run lint
        cd dashboard && npm run lint
        cd ../provisioner && npm run lint
    
    - name: Setup Helm
      uses: azure/setup-helm@v3
      with:
        version: '3.13.0'
    
    - name: Lint Helm charts
      run: |
        helm lint ./helm-charts/store-platform
        helm lint ./helm-charts/store-instance
        helm lint ./helm-charts/store-platform/charts/dashboard
        helm lint ./helm-charts/store-platform/charts/provisioner
    
    - name: Lint Dockerfiles
      uses: hadolint/hadolint-action@v3.1.0
      with:
        recursive: true
    
    - name: Lint YAML files
      run: |
        yamllint -c .yamllint.yml .
```

#### 2. Build

**Components:**
- Dashboard (React app)
- Provisioner (Node.js API)
- Init containers (WordPress setup, DB migrations)

**Build Steps:**
```yaml
build:
  runs-on: ubuntu-latest
  needs: lint
  steps:
    - uses: actions/checkout@v4
    
    - name: Set up Docker Buildx
      uses: docker/setup-buildx-action@v3
    
    - name: Build Dashboard
      run: |
        cd dashboard
        docker build -t store-platform/dashboard:${{ github.sha }} .
    
    - name: Build Provisioner
      run: |
        cd provisioner
        docker build -t store-platform/provisioner:${{ github.sha }} .
    
    - name: Build Init containers
      run: |
        cd docker/wp-init
        docker build -t store-platform/wp-init:${{ github.sha }} .
```

#### 3. Test

**Test Types:**
- Unit tests (Jest)
- Integration tests
- Helm template validation
- Security scanning (Trivy)

**Test Steps:**
```yaml
test:
  runs-on: ubuntu-latest
  needs: build
  steps:
    - uses: actions/checkout@v4
    
    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '20'
    
    - name: Run unit tests - Dashboard
      run: |
        cd dashboard
        npm ci
        npm run test -- --coverage --watchAll=false
    
    - name: Run unit tests - Provisioner
      run: |
        cd provisioner
        npm ci
        npm run test -- --coverage --watchAll=false
    
    - name: Validate Helm templates
      run: |
        helm template test-release ./helm-charts/store-platform \
          -f ./helm-charts/store-platform/values.yaml \
          -f ./helm-charts/store-platform/values-local.yaml \
          --debug
    
    - name: Run Trivy vulnerability scanner
      uses: aquasecurity/trivy-action@master
      with:
        image-ref: store-platform/dashboard:${{ github.sha }}
        format: 'sarif'
        output: 'trivy-results.sarif'
```

#### 4. Package & Push

**Artifacts:**
- Docker images to registry
- Helm charts to chart repository
- Build artifacts for deployment

**Package Steps:**
```yaml
package:
  runs-on: ubuntu-latest
  needs: test
  if: github.ref == 'refs/heads/main'
  steps:
    - uses: actions/checkout@v4
    
    - name: Set up Docker Buildx
      uses: docker/setup-buildx-action@v3
    
    - name: Login to Container Registry
      uses: docker/login-action@v3
      with:
        registry: ghcr.io
        username: ${{ github.actor }}
        password: ${{ secrets.GITHUB_TOKEN }}
    
    - name: Build and push Dashboard
      uses: docker/build-push-action@v5
      with:
        context: ./dashboard
        push: true
        tags: |
          ghcr.io/${{ github.repository }}/dashboard:${{ github.sha }}
          ghcr.io/${{ github.repository }}/dashboard:latest
        cache-from: type=gha
        cache-to: type=gha,mode=max
    
    - name: Build and push Provisioner
      uses: docker/build-push-action@v5
      with:
        context: ./provisioner
        push: true
        tags: |
          ghcr.io/${{ github.repository }}/provisioner:${{ github.sha }}
          ghcr.io/${{ github.repository }}/provisioner:latest
        cache-from: type=gha
        cache-to: type=gha,mode=max
    
    - name: Package Helm charts
      run: |
        helm package ./helm-charts/store-platform -d ./charts
        helm package ./helm-charts/store-instance -d ./charts
    
    - name: Upload Helm charts
      uses: actions/upload-artifact@v3
      with:
        name: helm-charts
        path: ./charts/*.tgz
```

## CD Pipeline

### Local Deployment (k3d)

**Trigger:** On every push to main branch
**Purpose:** Automated integration testing

**Deployment Steps:**
```yaml
deploy-local:
  runs-on: ubuntu-latest
  needs: package
  if: github.ref == 'refs/heads/main'
  steps:
    - uses: actions/checkout@v4
    
    - name: Setup k3d
      uses: AbsaOSS/k3d-action@v2
      with:
        cluster-name: store-platform-test
        args: >-
          --agents 1
          --no-lb
          --k3s-arg "--disable=traefik@server:0"
    
    - name: Install Helm
      uses: azure/setup-helm@v3
      with:
        version: '3.13.0'
    
    - name: Setup kubectl
      uses: azure/setup-kubectl@v3
    
    - name: Install ingress-nginx
      run: |
        helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
        helm repo update
        helm install ingress-nginx ingress-nginx/ingress-nginx \
          --namespace ingress-nginx \
          --create-namespace \
          --set controller.hostPort.enabled=true
    
    - name: Install cert-manager
      run: |
        helm repo add jetstack https://charts.jetstack.io
        helm repo update
        helm install cert-manager jetstack/cert-manager \
          --namespace cert-manager \
          --create-namespace \
          --set installCRDs=true
    
    - name: Wait for ingress controller
      run: |
        kubectl wait --namespace ingress-nginx \
          --for=condition=ready pod \
          --selector=app.kubernetes.io/component=controller \
          --timeout=120s
    
    - name: Download Helm charts
      uses: actions/download-artifact@v3
      with:
        name: helm-charts
        path: ./charts
    
    - name: Install Store Platform
      run: |
        helm install store-platform ./charts/store-platform-*.tgz \
          --namespace store-platform \
          --create-namespace \
          --set dashboard.image.tag=${{ github.sha }} \
          --set provisioner.image.tag=${{ github.sha }} \
          --set global.baseDomain=127.0.0.1.nip.io
    
    - name: Wait for deployment
      run: |
        kubectl wait --namespace store-platform \
          --for=condition=ready pod \
          --selector=app.kubernetes.io/name=provisioner \
          --timeout=300s
    
    - name: Get cluster info
      run: |
        kubectl get pods --all-namespaces
        kubectl get svc --all-namespaces
        kubectl get ingress --all-namespaces
    
    - name: Run smoke tests
      run: |
        # Wait for ingress to be ready
        sleep 30
        
        # Test dashboard endpoint
        curl -k -f https://dashboard.127.0.0.1.nip.io/health/ready || exit 1
        
        # Test API endpoint
        curl -k -f https://api.127.0.0.1.nip.io/health/ready || exit 1
    
    - name: Cleanup
      if: always()
      run: |
        k3d cluster delete store-platform-test
```

### Production Deployment (k3s)

**Trigger:** Manual approval or tag push
**Purpose:** Deploy to production VPS

**Prerequisites:**
- k3s cluster configured on VPS
- kubeconfig stored as GitHub secret
- DNS records configured

**Deployment Steps:**
```yaml
deploy-production:
  runs-on: ubuntu-latest
  needs: deploy-local
  if: github.ref == 'refs/heads/main'
  environment: production
  steps:
    - uses: actions/checkout@v4
    
    - name: Setup kubectl
      uses: azure/setup-kubectl@v3
    
    - name: Configure kubectl
      run: |
        mkdir -p ~/.kube
        echo "${{ secrets.KUBECONFIG }}" | base64 -d > ~/.kube/config
    
    - name: Install Helm
      uses: azure/setup-helm@v3
      with:
        version: '3.13.0'
    
    - name: Download Helm charts
      uses: actions/download-artifact@v3
      with:
        name: helm-charts
        path: ./charts
    
    - name: Deploy to production
      run: |
        helm upgrade --install store-platform ./charts/store-platform-*.tgz \
          --namespace store-platform \
          --create-namespace \
          --values ./helm-charts/store-platform/values-prod.yaml \
          --set dashboard.image.tag=${{ github.sha }} \
          --set provisioner.image.tag=${{ github.sha }} \
          --set global.baseDomain=${{ secrets.PROD_BASE_DOMAIN }} \
          --wait \
          --timeout 10m \
          --atomic
    
    - name: Verify deployment
      run: |
        kubectl get pods -n store-platform
        kubectl get svc -n store-platform
        kubectl get ingress -n store-platform
    
    - name: Run health checks
      run: |
        # Test production endpoints
        curl -f https://dashboard.${{ secrets.PROD_BASE_DOMAIN }}/health/ready
        curl -f https://api.${{ secrets.PROD_BASE_DOMAIN }}/health/ready
```

## GitHub Actions Workflow File

Complete workflow configuration:

```yaml
# .github/workflows/ci-cd.yml
name: CI/CD Pipeline

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

env:
  REGISTRY: ghcr.io
  IMAGE_PREFIX: ${{ github.repository }}

jobs:
  # ==========================================
  # CI Jobs
  # ==========================================
  
  lint:
    name: Lint & Static Analysis
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install dependencies
        run: |
          npm ci
          cd dashboard && npm ci
          cd ../provisioner && npm ci
      
      - name: Run ESLint - Dashboard
        run: cd dashboard && npm run lint
      
      - name: Run ESLint - Provisioner
        run: cd provisioner && npm run lint
      
      - name: Setup Helm
        uses: azure/setup-helm@v3
        with:
          version: '3.13.0'
      
      - name: Lint Helm Charts
        run: |
          helm lint ./helm-charts/store-platform
          helm lint ./helm-charts/store-instance
      
      - name: Lint Dockerfiles
        uses: hadolint/hadolint-action@v3.1.0
        with:
          dockerfile: "**/Dockerfile"
          recursive: true

  test:
    name: Unit & Integration Tests
    runs-on: ubuntu-latest
    needs: lint
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Run tests - Dashboard
        run: |
          cd dashboard
          npm ci
          npm run test:coverage -- --watchAll=false
      
      - name: Run tests - Provisioner
        run: |
          cd provisioner
          npm ci
          npm run test:coverage -- --watchAll=false
      
      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v3
        with:
          files: ./dashboard/coverage/lcov.info,./provisioner/coverage/lcov.info

  build:
    name: Build Docker Images
    runs-on: ubuntu-latest
    needs: lint
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
      
      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3
      
      - name: Build Dashboard image
        uses: docker/build-push-action@v5
        with:
          context: ./dashboard
          push: false
          load: true
          tags: dashboard:test
          cache-from: type=gha
          cache-to: type=gha,mode=max
      
      - name: Build Provisioner image
        uses: docker/build-push-action@v5
        with:
          context: ./provisioner
          push: false
          load: true
          tags: provisioner:test
          cache-from: type=gha
          cache-to: type=gha,mode=max

  security-scan:
    name: Security Scan
    runs-on: ubuntu-latest
    needs: build
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
      
      - name: Run Trivy vulnerability scanner
        uses: aquasecurity/trivy-action@master
        with:
          scan-type: 'fs'
          scan-ref: '.'
          format: 'sarif'
          output: 'trivy-results.sarif'
      
      - name: Upload Trivy scan results
        uses: github/codeql-action/upload-sarif@v2
        with:
          sarif_file: 'trivy-results.sarif'

  # ==========================================
  # CD Jobs
  # ==========================================
  
  publish:
    name: Publish Images & Charts
    runs-on: ubuntu-latest
    needs: [test, build, security-scan]
    if: github.ref == 'refs/heads/main'
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
      
      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3
      
      - name: Login to Container Registry
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      
      - name: Extract metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: |
            ${{ env.REGISTRY }}/${{ env.IMAGE_PREFIX }}/dashboard
            ${{ env.REGISTRY }}/${{ env.IMAGE_PREFIX }}/provisioner
      
      - name: Build and push Dashboard
        uses: docker/build-push-action@v5
        with:
          context: ./dashboard
          push: true
          tags: |
            ${{ env.REGISTRY }}/${{ env.IMAGE_PREFIX }}/dashboard:${{ github.sha }}
            ${{ env.REGISTRY }}/${{ env.IMAGE_PREFIX }}/dashboard:latest
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
      
      - name: Build and push Provisioner
        uses: docker/build-push-action@v5
        with:
          context: ./provisioner
          push: true
          tags: |
            ${{ env.REGISTRY }}/${{ env.IMAGE_PREFIX }}/provisioner:${{ github.sha }}
            ${{ env.REGISTRY }}/${{ env.IMAGE_PREFIX }}/provisioner:latest
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
      
      - name: Setup Helm
        uses: azure/setup-helm@v3
        with:
          version: '3.13.0'
      
      - name: Package Helm charts
        run: |
          mkdir -p ./charts
          helm package ./helm-charts/store-platform -d ./charts
          helm package ./helm-charts/store-instance -d ./charts
          helm repo index ./charts
      
      - name: Upload charts artifact
        uses: actions/upload-artifact@v3
        with:
          name: helm-charts
          path: ./charts/

  deploy-local:
    name: Deploy to Local (k3d)
    runs-on: ubuntu-latest
    needs: publish
    if: github.ref == 'refs/heads/main'
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
      
      - name: Create k3d cluster
        uses: AbsaOSS/k3d-action@v2
        with:
          cluster-name: store-platform-ci
          args: >-
            --agents 1
            --no-lb
            --k3s-arg "--disable=traefik@server:0"
      
      - name: Install Helm
        uses: azure/setup-helm@v3
        with:
          version: '3.13.0'
      
      - name: Setup kubectl
        uses: azure/setup-kubectl@v3
      
      - name: Install infrastructure
        run: |
          # Install ingress-nginx
          helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
          helm repo add jetstack https://charts.jetstack.io
          helm repo update
          
          helm install ingress-nginx ingress-nginx/ingress-nginx \
            --namespace ingress-nginx \
            --create-namespace \
            --wait
          
          # Install cert-manager
          helm install cert-manager jetstack/cert-manager \
            --namespace cert-manager \
            --create-namespace \
            --set installCRDs=true \
            --wait
      
      - name: Download Helm charts
        uses: actions/download-artifact@v3
        with:
          name: helm-charts
          path: ./charts
      
      - name: Deploy platform
        run: |
          helm install store-platform ./charts/store-platform-*.tgz \
            --namespace store-platform \
            --create-namespace \
            --set dashboard.image.repository=${{ env.REGISTRY }}/${{ env.IMAGE_PREFIX }}/dashboard \
            --set dashboard.image.tag=${{ github.sha }} \
            --set provisioner.image.repository=${{ env.REGISTRY }}/${{ env.IMAGE_PREFIX }}/provisioner \
            --set provisioner.image.tag=${{ github.sha }} \
            --set global.baseDomain=127.0.0.1.nip.io \
            --wait \
            --timeout 10m
      
      - name: Run smoke tests
        run: |
          sleep 30
          kubectl get all -n store-platform
          kubectl wait --for=condition=ready pod -l app.kubernetes.io/name=provisioner -n store-platform --timeout=300s
      
      - name: Cleanup cluster
        if: always()
        run: k3d cluster delete store-platform-ci

  deploy-production:
    name: Deploy to Production
    runs-on: ubuntu-latest
    needs: deploy-local
    if: github.ref == 'refs/heads/main'
    environment:
      name: production
      url: https://dashboard.stores.example.com
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
      
      - name: Setup kubectl
        uses: azure/setup-kubectl@v3
      
      - name: Configure kubeconfig
        run: |
          mkdir -p ~/.kube
          echo "${{ secrets.KUBECONFIG_PROD }}" | base64 -d > ~/.kube/config
      
      - name: Install Helm
        uses: azure/setup-helm@v3
        with:
          version: '3.13.0'
      
      - name: Download Helm charts
        uses: actions/download-artifact@v3
        with:
          name: helm-charts
          path: ./charts
      
      - name: Deploy to production
        run: |
          helm upgrade --install store-platform ./charts/store-platform-*.tgz \
            --namespace store-platform \
            --create-namespace \
            --values ./helm-charts/store-platform/values-prod.yaml \
            --set dashboard.image.repository=${{ env.REGISTRY }}/${{ env.IMAGE_PREFIX }}/dashboard \
            --set dashboard.image.tag=${{ github.sha }} \
            --set provisioner.image.repository=${{ env.REGISTRY }}/${{ env.IMAGE_PREFIX }}/provisioner \
            --set provisioner.image.tag=${{ github.sha }} \
            --set global.baseDomain=${{ secrets.PROD_BASE_DOMAIN }} \
            --wait \
            --timeout 10m \
            --atomic
      
      - name: Verify deployment
        run: |
          kubectl get pods -n store-platform
          kubectl rollout status deployment/dashboard -n store-platform
          kubectl rollout status deployment/provisioner -n store-platform
```

## Required Secrets and Permissions

### GitHub Secrets

| Secret Name | Description | Required For |
|-------------|-------------|--------------|
| `GITHUB_TOKEN` | Auto-generated, for container registry | All pushes |
| `KUBECONFIG_PROD` | Base64-encoded kubeconfig for production | Production deployment |
| `PROD_BASE_DOMAIN` | Production domain (e.g., stores.example.com) | Production deployment |

### GitHub Environments

**Production Environment:**
- Require approval before deployment
- Protection rules: specific reviewers
- Deployment branches: main only
- Wait timer: optional

### Repository Permissions

**Actions Permissions:**
- Read repository contents
- Write packages (for container images)
- Read and write statuses

**Workflow Permissions:**
```yaml
permissions:
  contents: read
  packages: write
  id-token: write
  security-events: write
```

## Pipeline Optimization

### Caching Strategy

```yaml
# Docker layer caching
- uses: docker/build-push-action@v5
  with:
    cache-from: type=gha
    cache-to: type=gha,mode=max

# npm caching
- uses: actions/setup-node@v4
  with:
    cache: 'npm'

# Helm chart caching
- uses: actions/cache@v3
  with:
    path: ~/.cache/helm
    key: ${{ runner.os }}-helm-${{ hashFiles('**/Chart.lock') }}
```

### Parallel Execution

```yaml
jobs:
  lint:
    # Independent
  
  test-dashboard:
    needs: lint
    # Runs in parallel with test-provisioner
  
  test-provisioner:
    needs: lint
    # Runs in parallel with test-dashboard
  
  build:
    needs: [test-dashboard, test-provisioner]
    # Only runs after all tests pass
```

## Local Development CI/CD

### Pre-commit Hooks

```yaml
# .pre-commit-config.yaml
repos:
  - repo: https://github.com/pre-commit/pre-commit-hooks
    rev: v4.5.0
    hooks:
      - id: trailing-whitespace
      - id: end-of-file-fixer
      - id: check-yaml
      - id: check-json
  
  - repo: https://github.com/pre-commit/mirrors-eslint
    rev: v8.55.0
    hooks:
      - id: eslint
        files: \.[jt]sx?$
  
  - repo: local
    hooks:
      - id: helm-lint
        name: Helm lint
        entry: helm lint
        language: system
        files: ^helm-charts/
      
      - id: dockerfile-lint
        name: Dockerfile lint
        entry: hadolint
        language: system
        files: Dockerfile
```

### Local Testing Script

```bash
#!/bin/bash
# scripts/local-ci.sh

set -e

echo "=== Running Local CI Pipeline ==="

# Lint
echo "[1/5] Running linters..."
npm run lint
cd dashboard && npm run lint && cd ..
cd provisioner && npm run lint && cd ..
helm lint ./helm-charts/store-platform

# Test
echo "[2/5] Running tests..."
cd dashboard && npm test -- --watchAll=false && cd ..
cd provisioner && npm test -- --watchAll=false && cd ..

# Build
echo "[3/5] Building images..."
docker build -t dashboard:test ./dashboard
docker build -t provisioner:test ./provisioner

# Local deploy
echo "[4/5] Deploying to local k3d..."
k3d cluster create test --agents 1
# ... deployment commands ...

# E2E tests
echo "[5/5] Running E2E tests..."
npm run test:e2e

# Cleanup
k3d cluster delete test

echo "=== Local CI Complete ==="
```

## Rollback Strategy

### Automatic Rollback

Helm's `--atomic` flag ensures automatic rollback on failure:

```yaml
- name: Deploy
  run: |
    helm upgrade --install app ./chart \
      --atomic \
      --timeout 10m \
      --cleanup-on-fail
```

### Manual Rollback

```bash
# View history
helm history store-platform -n store-platform

# Rollback to previous version
helm rollback store-platform 2 -n store-platform

# Rollback to specific revision
helm rollback store-platform 1 -n store-platform
```

## Monitoring Deployments

### Deployment Notifications

```yaml
- name: Notify Slack
  uses: 8398a7/action-slack@v3
  if: always()
  with:
    status: ${{ job.status }}
    fields: repo,message,commit,author,action,eventName,ref,workflow
  env:
    SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
```

### Deployment Status

Track deployment status in GitHub:
```yaml
- name: Create deployment
  uses: actions/github-script@v7
  with:
    script: |
      github.rest.repos.createDeployment({
        owner: context.repo.owner,
        repo: context.repo.repo,
        ref: context.sha,
        environment: 'production',
        auto_merge: false,
        required_contexts: []
      })
```

## Troubleshooting CI/CD

### Common Issues

1. **k3d cluster creation fails**
   - Check Docker is running
   - Verify available resources (RAM/CPU)
   - Try with `--no-lb` flag

2. **Ingress not accessible**
   - Verify hostPort is mapped
   - Check `/etc/hosts` entries
   - Ensure ingress controller is ready

3. **Image pull fails**
   - Verify registry authentication
   - Check image tags exist
   - Validate image names

4. **Helm upgrade fails**
   - Check resource quotas
   - Verify values files
   - Use `--debug` for verbose output
