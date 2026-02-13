# Store Provisioning Platform - Manual Testing & Operations Guide

## Table of Contents
1. [Quick Start Guide](#quick-start-guide)
2. [Prerequisites](#prerequisites)
3. [Local Development Setup](#local-development-setup)
4. [Manual Testing Procedures](#manual-testing-procedures)
5. [Production Deployment](#production-deployment)
6. [Troubleshooting](#troubleshooting)
7. [Maintenance Operations](#maintenance-operations)

---

## Quick Start Guide

### 5-Minute Quick Start

```bash
# 1. Clone and setup
git clone <repository-url>
cd store-platform

# 2. Start local Kubernetes
npm run k3d:up

# 3. Install platform
npm run install:platform

# 4. Start backend (Terminal 1)
cd backend/api && npm install && npm run dev

# 5. Start frontend (Terminal 2)
cd frontend/dashboard && npm install && npm run dev

# 6. Access dashboard
open http://localhost:5173
```

---

## Prerequisites

### Required Software

| Tool | Version | Purpose | Installation |
|------|---------|---------|--------------|
| Docker Desktop | 4.25+ | Container runtime | [Download](https://www.docker.com/products/docker-desktop) |
| kubectl | 1.28+ | Kubernetes CLI | `brew install kubectl` |
| Helm | 3.13+ | Package manager | `brew install helm` |
| k3d | 5.6+ | Local k3s cluster | `brew install k3d` |
| Node.js | 20.x | Runtime | `brew install node` |
| npm | 10.x | Package manager | Included with Node.js |

### Verify Installation

```bash
# Check all tools
docker --version
kubectl version --client
helm version
k3d version
node --version
npm --version

# Expected output versions:
# Docker: 24.x or higher
# kubectl: v1.28.x or higher
# Helm: v3.13.x or higher
# k3d: v5.6.x or higher
# Node.js: v20.x.x
# npm: 10.x.x
```

---

## Local Development Setup

### Step 1: Environment Setup

```bash
# Clone repository
git clone <your-repo-url>
cd store-platform

# Install root dependencies (if using workspaces)
npm install

# Verify directory structure
ls -la
# Expected:
# docs/
# frontend/
# backend/
# helm/
# scripts/
# e2e/
```

### Step 2: Start Kubernetes Cluster

```bash
# Create k3d cluster
./scripts/setup-k3d.sh

# Verify cluster is running
kubectl cluster-info
kubectl get nodes

# Expected output:
# Kubernetes control plane is running at https://0.0.0.0:6443
# CoreDNS is running at https://0.0.0.0:6443/api/v1/namespaces/kube-system/services/kube-dns:dns/proxy
# 
# NAME                  STATUS   ROLES                  AGE   VERSION
# k3d-store-platform-server-0   Ready    control-plane,master   30s   v1.28.x
# k3d-store-platform-agent-0    Ready    <none>                 30s   v1.28.x
```

### Step 3: Install Platform Infrastructure

```bash
# Install ingress-nginx and cert-manager
npm run install:platform

# Or manually:
# Install ingress-nginx
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/main/deploy/static/provider/cloud/deploy.yaml

# Install cert-manager
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.13.2/cert-manager.yaml

# Wait for ingress controller
kubectl wait --namespace ingress-nginx \
  --for=condition=ready pod \
  --selector=app.kubernetes.io/component=controller \
  --timeout=180s

# Verify ingress is ready
kubectl get pods -n ingress-nginx
```

### Step 4: Install Platform Helm Chart

```bash
# Install platform (database + API + Dashboard)
helm install store-platform helm/dashboard \
  --namespace store-platform \
  --create-namespace \
  -f helm/dashboard/values-local.yaml \
  --wait --timeout 5m

# Verify installation
kubectl get pods -n store-platform
kubectl get svc -n store-platform
kubectl get ingress -n store-platform

# Expected pods:
# NAME                           READY   STATUS    RESTARTS   AGE
# store-platform-api-xxx         1/1     Running   0          2m
# store-platform-dashboard-xxx   1/1     Running   0          2m
# store-platform-postgres-xxx    1/1     Running   0          2m
```

### Step 5: Start Development Servers

**Terminal 1 - Backend API:**
```bash
cd backend/api
npm install
npm run dev

# Expected output:
# > api@1.0.0 dev
# > ts-node-dev --respawn --transpile-only src/index.ts
# 
# [INFO] Connected to database
# [INFO] API server running on port 8080
# [INFO] Health check available at http://localhost:8080/health
```

**Terminal 2 - Frontend Dashboard:**
```bash
cd frontend/dashboard
npm install
npm run dev

# Expected output:
# > dashboard@1.0.0 dev
# > vite
# 
#   VITE v5.0.0  ready in 500 ms
# 
#   ➜  Local:   http://localhost:5173/
#   ➜  Network: http://192.168.1.100:5173/
```

### Step 6: Verify Everything Works

```bash
# Test API health
curl http://localhost:8080/health
# Expected: {"status":"ok"}

# Test API stores endpoint
curl http://localhost:8080/api/v1/stores
# Expected: [] (empty array)

# Access dashboard
open http://localhost:5173
# Should see dashboard with no stores
```

---

## Manual Testing Procedures

### Test 1: Store Creation Flow

**Via Dashboard UI:**
1. Navigate to http://localhost:5173
2. Click "Create Store" button
3. Fill in form:
   - Store Name: `test-store`
   - Display Name: `Test Store`
   - Engine: WooCommerce (Medusa disabled)
   - Plan: Basic
4. Click "Create Store"
5. Verify:
   - Store appears in list with "provisioning" status
   - Status changes to "ready" after 3-5 minutes
   - URL is generated

**Via API:**
```bash
# Create store
curl -X POST http://localhost:8080/api/v1/stores \
  -H "Content-Type: application/json" \
  -d '{
    "name": "api-test-store",
    "displayName": "API Test Store",
    "engine": "woocommerce",
    "plan": "basic"
  }'

# Expected response:
# {
#   "id": "abc-123",
#   "name": "api-test-store",
#   "status": "pending",
#   "engine": "woocommerce",
#   "plan": "basic",
#   ...
# }

# Check store status
curl http://localhost:8080/api/v1/stores/abc-123

# Wait for provisioning (poll every 30s)
while true; do
  STATUS=$(curl -s http://localhost:8080/api/v1/stores/abc-123 | jq -r '.status')
  echo "Status: $STATUS"
  if [ "$STATUS" = "ready" ]; then
    echo "Store is ready!"
    break
  fi
  sleep 30
done
```

### Test 2: WooCommerce Store Functionality

```bash
# Get store URL
STORE_URL=$(curl -s http://localhost:8080/api/v1/stores/abc-123 | jq -r '.url')
echo "Store URL: $STORE_URL"

# Test store is accessible
curl -I $STORE_URL
# Expected: HTTP/1.1 200 OK

# Check WordPress is running
curl $STORE_URL/wp-includes/images/blank.gif
# Expected: HTTP 200 with image content

# Verify WooCommerce is active
curl $STORE_URL/shop
# Expected: Returns shop page HTML
```

### Test 3: Store Deletion

**Via Dashboard:**
1. Navigate to Stores list
2. Click on a store
3. Click "Delete Store" button
4. Confirm deletion
5. Verify store disappears from list

**Via API:**
```bash
# Delete store
curl -X DELETE http://localhost:8080/api/v1/stores/abc-123

# Verify deletion
curl http://localhost:8080/api/v1/stores/abc-123
# Expected: 404 Not Found

# Check namespace is cleaned up
kubectl get namespace store-abc-123
# Expected: Error from server (NotFound)
```

### Test 4: API Endpoints

```bash
# Test all endpoints

# 1. Health check
curl http://localhost:8080/health

# 2. List all stores
curl http://localhost:8080/api/v1/stores

# 3. Create store
curl -X POST http://localhost:8080/api/v1/stores \
  -H "Content-Type: application/json" \
  -d '{"name":"endpoint-test","engine":"woocommerce","plan":"basic"}'

# 4. Get specific store
curl http://localhost:8080/api/v1/stores/<store-id>

# 5. Get store events
curl http://localhost:8080/api/v1/stores/<store-id>/events

# 6. Get store jobs
curl http://localhost:8080/api/v1/stores/<store-id>/jobs

# 7. Delete store
curl -X DELETE http://localhost:8080/api/v1/stores/<store-id>

# 8. Check error handling - invalid engine
curl -X POST http://localhost:8080/api/v1/stores \
  -H "Content-Type: application/json" \
  -d '{"name":"test","engine":"medusa"}'
# Expected: 400 error with "Coming in Round 2" message
```

### Test 5: Kubernetes Resources

```bash
# Check all namespaces
kubectl get namespaces

# Check platform pods
kubectl get pods -n store-platform

# Check store namespaces
kubectl get namespaces -l store-platform/type=store

# Check Helm releases
helm list --all-namespaces

# Check ingress
kubectl get ingress --all-namespaces

# Check services
kubectl get svc --all-namespaces

# Check persistent volumes
kubectl get pvc --all-namespaces

# View logs for API
kubectl logs -n store-platform -l app.kubernetes.io/name=api --tail=100 -f

# View logs for specific store
kubectl logs -n store-<id> -l app.kubernetes.io/component=wordpress --tail=100
```

### Test 6: Helm Operations

```bash
# List releases
helm list -n store-platform

# Get release values
helm get values store-platform -n store-platform

# Upgrade release
helm upgrade store-platform helm/dashboard \
  -n store-platform \
  -f helm/dashboard/values-local.yaml

# Rollback (if needed)
helm rollback store-platform 1 -n store-platform

# Uninstall
helm uninstall store-platform -n store-platform
```

---

## Production Deployment

### Pre-Deployment Checklist

- [ ] All tests passing locally
- [ ] Docker images built and pushed
- [ ] Security scan completed (no critical vulnerabilities)
- [ ] Helm charts linted successfully
- [ ] Database migrations tested
- [ ] Backup strategy configured
- [ ] Monitoring and alerting set up
- [ ] SSL certificates configured
- [ ] Domain DNS configured

### Production Deployment Steps

```bash
# 1. Build and push images
export REGISTRY=ghcr.io/your-org
export IMAGE_TAG=$(git rev-parse --short HEAD)

# Build images
docker build -t $REGISTRY/dashboard:$IMAGE_TAG ./frontend/dashboard
docker build -t $REGISTRY/api:$IMAGE_TAG ./backend/api

# Push images
docker push $REGISTRY/dashboard:$IMAGE_TAG
docker push $REGISTRY/api:$IMAGE_TAG

# 2. Update Helm values for production
cat > helm/dashboard/values-prod.yaml << EOF
global:
  baseDomain: yourdomain.com
  certIssuer: letsencrypt-prod
  storageClass: premium-rwo

dashboard:
  image:
    repository: $REGISTRY/dashboard
    tag: $IMAGE_TAG
  replicas: 2
  resources:
    limits:
      memory: 512Mi
      cpu: 500m
    requests:
      memory: 256Mi
      cpu: 250m

api:
  image:
    repository: $REGISTRY/api
    tag: $IMAGE_TAG
  replicas: 3
  resources:
    limits:
      memory: 1Gi
      cpu: 1000m
    requests:
      memory: 512Mi
      cpu: 500m

ingress:
  annotations:
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
    nginx.ingress.kubernetes.io/rate-limit: "100"
EOF

# 3. Deploy to production
helm upgrade --install store-platform helm/dashboard \
  --namespace store-platform \
  --create-namespace \
  -f helm/dashboard/values-prod.yaml \
  --wait --timeout 10m

# 4. Verify deployment
kubectl get pods -n store-platform
kubectl get ingress -n store-platform

# 5. Run smoke tests
./scripts/smoke-tests.sh
```

---

## Troubleshooting

### Common Issues and Solutions

#### Issue 1: Store stuck in "provisioning" status

**Symptoms:** Store status never changes from "provisioning"

**Diagnosis:**
```bash
# Check store namespace
kubectl get namespace store-<id>

# Check Helm release
helm list -n store-<id>

# Check pods
kubectl get pods -n store-<id>

# Check events
kubectl get events -n store-<id> --sort-by='.lastTimestamp'

# Check API logs
kubectl logs -n store-platform -l app.kubernetes.io/name=api --tail=200
```

**Solutions:**
1. Check if ingress controller is ready
2. Verify storage class exists
3. Check resource quotas not exceeded
4. Review Helm release errors: `helm history store-<id> -n store-<id>`

#### Issue 2: Cannot access store URL

**Symptoms:** Store shows as "ready" but URL returns error

**Diagnosis:**
```bash
# Check ingress
kubectl get ingress -n store-<id>

# Check service endpoints
kubectl get endpoints -n store-<id>

# Test from within cluster
kubectl run debug --rm -it --image=curlimages/curl -- \
  curl http://wordpress.store-<id>.svc.cluster.local

# Check SSL certificate
kubectl get certificate -n store-<id>
kubectl describe certificate store-<id>-tls -n store-<id>
```

**Solutions:**
1. Wait for DNS propagation (can take 5-10 minutes)
2. Check ingress controller logs
3. Verify SSL certificate issued successfully
4. Check /etc/hosts if using local domain

#### Issue 3: Database connection errors

**Symptoms:** WordPress cannot connect to MySQL

**Diagnosis:**
```bash
# Check MySQL pod
kubectl get pods -n store-<id> -l app.kubernetes.io/component=mysql

# Check MySQL logs
kubectl logs -n store-<id> -l app.kubernetes.io/component=mysql

# Test MySQL connection
kubectl run mysql-client --rm -it --image=mysql:8.0 -- \
  mysql -h mysql.store-<id>.svc.cluster.local -u wordpress -p

# Check secrets
kubectl get secrets -n store-<id>
kubectl get secret mysql-credentials -n store-<id> -o yaml
```

**Solutions:**
1. Ensure MySQL pod is ready before WordPress starts
2. Verify secrets are correctly mounted
3. Check database user permissions
4. Restart WordPress deployment

#### Issue 4: API server connection refused

**Symptoms:** Cannot connect to backend API

**Diagnosis:**
```bash
# Check API pod status
kubectl get pods -n store-platform -l app.kubernetes.io/name=api

# Check API logs
kubectl logs -n store-platform -l app.kubernetes.io/name=api

# Check service
kubectl get svc -n store-platform api

# Port forward for local testing
kubectl port-forward -n store-platform svc/api 8080:80
```

**Solutions:**
1. Verify PostgreSQL is running
2. Check database connection string
3. Review API pod logs for errors
4. Ensure service is correctly configured

---

## Maintenance Operations

### Regular Maintenance Tasks

#### Daily Checks
```bash
#!/bin/bash
# daily-checks.sh

echo "=== Daily Health Checks ==="

# Check all pods are running
echo "Checking pod status..."
kubectl get pods --all-namespaces | grep -v Running | grep -v Completed

# Check node health
echo "Checking nodes..."
kubectl get nodes

# Check disk usage
echo "Checking disk usage..."
kubectl top nodes 2>/dev/null || echo "Metrics server not available"

# Check certificate expiration
echo "Checking certificates..."
kubectl get certificates --all-namespaces

# Check for failed jobs
echo "Checking jobs..."
kubectl get jobs --all-namespaces | grep -v "0/0"
```

#### Weekly Tasks
```bash
#!/bin/bash
# weekly-maintenance.sh

echo "=== Weekly Maintenance ==="

# Update base images
echo "Checking for base image updates..."
docker pull node:20-alpine
docker pull nginx:alpine
docker pull mysql:8.0

# Rotate logs
echo "Rotating logs..."
kubectl get pods --all-namespaces -o name | \
  xargs -I {} kubectl logs {} --since=168h > /var/log/k8s/weekly-$(date +%Y%m%d).log

# Audit secrets age
echo "Auditing secrets..."
./scripts/security/rotate-secrets.sh audit

# Backup database
echo "Creating database backup..."
kubectl exec -n store-platform deploy/postgres -- \
  pg_dump -U postgres store_platform > backup-$(date +%Y%m%d).sql
```

#### Monthly Tasks
```bash
#!/bin/bash
# monthly-maintenance.sh

echo "=== Monthly Maintenance ==="

# Review RBAC permissions
echo "Reviewing RBAC..."
kubectl get clusterroles,clusterrolebindings --all-namespaces

# Check for unused resources
echo "Checking for unused resources..."
kubectl get pods --all-namespaces --field-selector=status.phase=Succeeded
kubectl get pods --all-namespaces --field-selector=status.phase=Failed

# Update dependencies
echo "Updating dependencies..."
cd backend/api && npm audit fix
cd frontend/dashboard && npm audit fix

# Security scan
echo "Running security scans..."
trivy image ghcr.io/your-org/dashboard:latest
trivy image ghcr.io/your-org/api:latest
```

### Backup and Recovery

#### Database Backup
```bash
# Create backup
kubectl exec -n store-platform deploy/postgres -- \
  pg_dump -U postgres -d store_platform -Fc > backup-$(date +%Y%m%d).dump

# Verify backup
pg_restore --list backup-$(date +%Y%m%d).dump

# Schedule with cron (daily at 2 AM)
0 2 * * * /path/to/backup-script.sh
```

#### Database Restore
```bash
# Restore from backup
kubectl exec -i -n store-platform deploy/postgres -- \
  pg_restore -U postgres -d store_platform --clean --if-exists < backup.dump

# Restart API to reconnect
kubectl rollout restart deployment/api -n store-platform
```

### Scaling Operations

#### Scale Platform Components
```bash
# Scale API replicas
kubectl scale deployment api --replicas=5 -n store-platform

# Scale Dashboard replicas
kubectl scale deployment dashboard --replicas=3 -n store-platform

# Horizontal Pod Autoscaler (if configured)
kubectl autoscale deployment api --min=2 --max=10 --cpu-percent=70 -n store-platform
```

#### Scale Store Resources
```bash
# Upgrade store plan
helm upgrade store-<id> helm/store-engine/woocommerce \
  -n store-<id> \
  --set plan=premium \
  --set wordpress.resources.limits.memory=2Gi

# Restart to apply changes
kubectl rollout restart deployment/wordpress -n store-<id>
```

---

## Advanced Testing

### Load Testing

```bash
# Install k6
brew install k6

# Create load test script
cat > load-test.js << 'EOF'
import http from 'k6/http';
import { check, sleep } from 'k6';

export let options = {
  stages: [
    { duration: '2m', target: 10 },
    { duration: '5m', target: 50 },
    { duration: '2m', target: 100 },
    { duration: '5m', target: 100 },
    { duration: '2m', target: 0 },
  ],
};

export default function() {
  let res = http.get('http://localhost:8080/api/v1/stores');
  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
  });
  sleep(1);
}
EOF

# Run load test
k6 run load-test.js
```

### Chaos Engineering

```bash
# Install chaos mesh
helm repo add chaos-mesh https://charts.chaos-mesh.org
helm install chaos-mesh chaos-mesh/chaos-mesh -n chaos-testing --create-namespace

# Test pod failure
kubectl apply -f - <<EOF
apiVersion: chaos-mesh.org/v1alpha1
kind: PodChaos
metadata:
  name: api-pod-failure
  namespace: chaos-testing
spec:
  action: pod-failure
  mode: one
  duration: 30s
  selector:
    namespaces:
      - store-platform
    labelSelectors:
      app.kubernetes.io/name: api
EOF
```

---

## Useful Commands Reference

### kubectl Quick Reference

```bash
# Get resources
k get pods,services,ingress --all-namespaces

# Describe resource
k describe pod <pod-name> -n <namespace>

# View logs
k logs <pod-name> -n <namespace> -f --tail=100

# Execute command in pod
k exec -it <pod-name> -n <namespace> -- /bin/sh

# Port forward
k port-forward svc/<service-name> 8080:80 -n <namespace>

# Copy files
k cp <pod-name>:/path/to/file ./local-file -n <namespace>

# Watch resources
k get pods -w -n <namespace>

# Top resources
k top nodes
k top pods --all-namespaces
```

### Helm Quick Reference

```bash
# Search charts
helm search hub wordpress

# Install chart
helm install <release> <chart> -n <namespace>

# Upgrade chart
helm upgrade <release> <chart> -n <namespace>

# Rollback
helm rollback <release> <revision> -n <namespace>

# List releases
helm list --all-namespaces

# Get manifest
helm get manifest <release> -n <namespace>

# Get values
helm get values <release> -n <namespace>

# Template rendering
helm template <release> <chart> -f values.yaml
```

---

*Last Updated: 2024*
*Version: 1.0*
*For updates and issues, see project documentation*
