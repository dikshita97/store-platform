# Quick Start Guide - Run & Test Store Provisioning Platform

## 🚀 Running the Platform (5 Minutes)

### Step 1: Prerequisites Check

```bash
# Check if all tools are installed
docker --version          # Should be 24.x+
kubectl version --client  # Should be v1.28+
helm version              # Should be v3.13+
k3d version               # Should be v5.6+
node --version            # Should be v20.x
```

### Step 2: Start Everything

```bash
# 1. Clone and enter directory
cd store-platform

# 2. Start Kubernetes cluster (creates k3d cluster)
npm run k3d:up

# Verify cluster
kubectl get nodes
# Should show 2 nodes (1 server, 1 agent)

# 3. Install platform infrastructure
npm run install:platform

# This installs:
# - NGINX Ingress Controller
# - cert-manager for SSL
# - Waits for everything to be ready

# 4. Install the platform (API + Dashboard + Database)
helm install store-platform helm/dashboard \
  --namespace store-platform \
  --create-namespace \
  -f helm/dashboard/values-local.yaml \
  --wait --timeout 5m

# Verify platform is running
kubectl get pods -n store-platform
# Should show 3 pods: api, dashboard, postgres - all Running
```

### Step 3: Access the Dashboard

```bash
# Port forward to access locally
kubectl port-forward svc/dashboard 5173:80 -n store-platform &
kubectl port-forward svc/api 8080:80 -n store-platform &

# Open in browser
open http://localhost:5173

# Or use the local dev servers (for development):
# Terminal 1: cd backend/api && npm install && npm run dev
# Terminal 2: cd frontend/dashboard && npm install && npm run dev
```

---

## 🧪 Testing the Platform

### Test 1: Create Your First Store (2 minutes)

**Via Web UI:**
1. Go to http://localhost:5173
2. Click "Create Store" button
3. Fill in:
   - Store Name: `my-first-store`
   - Display Name: `My First Store`
   - Engine: WooCommerce
   - Plan: Basic
4. Click "Create"
5. Watch status change from "provisioning" → "ready" (takes 3-5 minutes)

**Via API (curl):**
```bash
# Create a store
curl -X POST http://localhost:8080/api/v1/stores \
  -H "Content-Type: application/json" \
  -d '{
    "name": "api-test-store",
    "displayName": "API Test Store",
    "engine": "woocommerce",
    "plan": "basic"
  }'

# Response will include store ID, e.g., "abc-123-xyz"

# Check store status (run every 30 seconds)
curl http://localhost:8080/api/v1/stores/abc-123-xyz

# When status is "ready", get the URL
curl http://localhost:8080/api/v1/stores/abc-123-xyz | jq -r '.url'
```

### Test 2: Access Your Store

```bash
# Get store URL
STORE_URL=$(curl -s http://localhost:8080/api/v1/stores/abc-123-xyz | jq -r '.url')
echo "Store URL: $STORE_URL"

# Test store is accessible
curl -I $STORE_URL

# Access WordPress admin (default credentials: admin / auto-generated)
open $STORE_URL/wp-admin
```

### Test 3: Run E2E Tests

```bash
# Install E2E dependencies
cd e2e/tests
npm install

# Run all tests
npm test

# Or run specific tests
npx cypress run --spec "cypress/e2e/store-creation.cy.ts"
npx cypress run --spec "cypress/e2e/woocommerce-order-flow.cy.ts"

# Open interactive test runner
npm run open
```

### Test 4: API Endpoints

```bash
# Health check
curl http://localhost:8080/health

# List all stores
curl http://localhost:8080/api/v1/stores

# Get specific store
curl http://localhost:8080/api/v1/stores/<store-id>

# Get store events
curl http://localhost:8080/api/v1/stores/<store-id>/events

# Delete store
curl -X DELETE http://localhost:8080/api/v1/stores/<store-id>
```

### Test 5: Kubernetes Resources

```bash
# Check all namespaces
kubectl get namespaces

# Check platform pods
kubectl get pods -n store-platform

# Check store namespaces (should see store-<id>)
kubectl get namespaces -l store-platform/type=store

# Check store pods
kubectl get pods -n store-abc-123-xyz

# View store logs
kubectl logs -n store-abc-123-xyz -l component=wordpress

# Check Helm releases
helm list --all-namespaces
```

---

## 📊 Testing Observability (Phase 9)

### Install Observability Stack

```bash
# Install Prometheus, Grafana, Loki
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo add grafana https://grafana.github.io/helm-charts
helm repo update

cd helm/observability
helm dependency update

helm upgrade --install observability . \
  --namespace observability \
  --create-namespace \
  --wait --timeout 10m

# Verify installation
kubectl get pods -n observability
```

### Access Monitoring

```bash
# Prometheus (metrics)
kubectl port-forward svc/observability-prometheus-server 9090:80 -n observability
open http://localhost:9090

# Test metrics query:
# store_platform_active_stores_total

# Grafana (dashboards)
kubectl port-forward svc/observability-grafana 3000:80 -n observability
open http://localhost:3000
# Login: admin / (get password: kubectl get secret grafana-credentials -n observability -o jsonpath="{.data.admin-password}" | base64 -d)

# Check logs in Grafana
# Go to Explore → Select "Loki" datasource
# Query: {app="api"}
```

---

## 🧹 Cleanup Commands

```bash
# Delete a specific store
curl -X DELETE http://localhost:8080/api/v1/stores/<store-id>

# Delete all test stores
kubectl get namespaces -l store-platform/type=store -o name | \
  xargs kubectl delete

# Uninstall platform
helm uninstall store-platform -n store-platform

# Uninstall observability
helm uninstall observability -n observability

# Delete cluster
k3d cluster delete store-platform

# Full cleanup (removes everything)
npm run k3d:down
```

---

## 🔍 Troubleshooting Quick Fixes

### Store stuck in "provisioning"
```bash
# Check what's happening
kubectl get events -n store-<id> --sort-by='.lastTimestamp'
kubectl logs -n store-platform -l app=api

# Common fix: restart the store
kubectl rollout restart deployment/wordpress -n store-<id>
```

### Can't access store URL
```bash
# Check ingress
kubectl get ingress -n store-<id>

# Check if DNS is resolving
ping test-store-<id>.127.0.0.1.nip.io

# Fix: Add to /etc/hosts if needed
# 127.0.0.1 test-store-<id>.127.0.0.1.nip.io
```

### API not responding
```bash
# Check API pod
kubectl get pods -n store-platform -l app=api
kubectl logs -n store-platform -l app=api

# Restart API
kubectl rollout restart deployment/api -n store-platform
```

---

## ✅ Verification Checklist

After running everything, verify:

- [ ] Dashboard accessible at http://localhost:5173
- [ ] API responds at http://localhost:8080/health
- [ ] Can create store via UI or API
- [ ] Store reaches "ready" status in 3-5 minutes
- [ ] Store URL is accessible
- [ ] E2E tests pass (`npm test` in e2e/tests/)
- [ ] Prometheus metrics available at http://localhost:9090
- [ ] Grafana dashboards visible at http://localhost:3000

---

## 🚀 Production Deployment (Optional)

```bash
# Build production images
docker build -t your-registry/dashboard:latest ./frontend/dashboard
docker build -t your-registry/api:latest ./backend/api

# Push to registry
docker push your-registry/dashboard:latest
docker push your-registry/api:latest

# Deploy to production
helm upgrade --install store-platform helm/dashboard \
  -f helm/dashboard/values-prod.yaml \
  --set dashboard.image.repository=your-registry/dashboard \
  --set api.image.repository=your-registry/api
```

---

**Need help?** Check the full manual at `docs/MANUAL_TESTING_AND_OPERATIONS.md`
