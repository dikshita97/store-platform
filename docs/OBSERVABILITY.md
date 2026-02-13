# Observability Guide for Store Provisioning Platform

## Overview

This guide covers the complete observability stack for the Store Provisioning Platform, including metrics collection, logging, visualization, and alerting.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Store Platform                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   API        │  │   Stores     │  │   Dashboard  │     │
│  │  (Metrics)   │  │  (Metrics)   │  │              │     │
│  └──────┬───────┘  └──────┬───────┘  └──────────────┘     │
└─────────┼────────────────┼────────────────────────────────┘
          │                │
          ▼                ▼
┌─────────────────────────────────────────────────────────────┐
│              Observability Stack                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │  Prometheus  │  │    Loki      │  │   Grafana    │     │
│  │  (Metrics)   │  │   (Logs)     │  │  (Dashboard) │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│  ┌──────────────┐  ┌──────────────┐                        │
│  │  Promtail    │  │ Alertmanager │                        │
│  │(Log Collector)│  │  (Alerts)    │                        │
│  └──────────────┘  └──────────────┘                        │
└─────────────────────────────────────────────────────────────┘
```

## Components

### 1. Prometheus - Metrics Collection

**Purpose**: Time-series database for metrics collection and storage

**Metrics Collected**:
- API performance (request duration, rate, errors)
- Store operations (creation, deletion, provisioning time)
- Kubernetes resources (CPU, memory, pods)
- Business metrics (active stores by engine/plan)

**Installation**:
```bash
helm dependency update helm/observability
helm upgrade --install observability helm/observability \
  --namespace observability \
  --create-namespace \
  --set prometheus.enabled=true
```

**Access**:
```bash
# Port forward to access Prometheus UI
kubectl port-forward svc/observability-prometheus-server 9090:80 -n observability

# Open browser
open http://localhost:9090
```

**Key Metrics**:

| Metric | Description | Type |
|--------|-------------|------|
| `store_platform_active_stores_total` | Number of active stores | Gauge |
| `store_platform_http_requests_total` | Total HTTP requests | Counter |
| `store_platform_http_request_duration_seconds` | Request latency | Histogram |
| `store_platform_store_operations_total` | Store operations count | Counter |
| `store_platform_provisioning_duration_seconds` | Provisioning time | Histogram |
| `store_platform_errors_total` | Error count | Counter |

**Query Examples**:
```promql
# Active stores by engine
store_platform_active_stores_total by (engine)

# API error rate over 5 minutes
rate(store_platform_http_requests_total{status_code=~"5.."}[5m])

# 95th percentile latency
histogram_quantile(0.95, rate(store_platform_http_request_duration_seconds_bucket[5m]))

# Provisioning success rate
rate(store_platform_store_operations_total{operation="create",status="success"}[1h])
```

### 2. Grafana - Visualization

**Purpose**: Dashboard and visualization platform

**Installation**:
```bash
helm upgrade --install observability helm/observability \
  --namespace observability \
  --set grafana.enabled=true
```

**Access**:
```bash
# Get admin password
kubectl get secret grafana-credentials -n observability -o jsonpath="{.data.admin-password}" | base64 -d

# Port forward
kubectl port-forward svc/observability-grafana 3000:80 -n observability

# Open browser
open http://localhost:3000
# Login: admin / <password from above>
```

**Pre-configured Dashboards**:

1. **Platform Overview**
   - Active stores count
   - API request rate and latency
   - Error rate
   - Store distribution by engine/plan

2. **Store Details**
   - Individual store metrics
   - Provisioning duration trends
   - Store health status

3. **Kubernetes Cluster**
   - Node resource usage
   - Pod status
   - Persistent volume utilization

### 3. Loki - Log Aggregation

**Purpose**: Log aggregation and storage

**Features**:
- Centralized logging from all platform components
- Label-based log filtering
- Integration with Grafana for log visualization

**Log Sources**:
- API server logs
- Store pods (WordPress, MySQL)
- Helm operations
- Kubernetes events

**Query Examples**:
```logql
# All API error logs
{app="api", level="error"}

# Store provisioning logs
{namespace=~"store-.*", container="wordpress"}

# Recent errors
{level="error"} |= "error" | json

# Slow requests
{app="api"} | json | response_time > 1000
```

### 4. Promtail - Log Collection

**Purpose**: Log collector that forwards logs to Loki

**Configuration**:
- Automatically discovers all pods
- Adds Kubernetes metadata labels
- Parses container logs

**Log Pipeline**:
```
Pod Logs → Promtail → Loki → Grafana
```

### 5. Alertmanager - Alert Routing

**Purpose**: Alert routing and notification management

**Configured Alerts**:

**Critical Alerts** (Immediate Response Required):
- API down for > 1 minute
- High error rate (> 10%)
- Store down for > 2 minutes
- Persistent volume full (> 95%)
- Certificate expired

**Warning Alerts** (Action Required Within 24h):
- High latency (> 2s 95th percentile)
- Memory usage > 85%
- CPU usage > 85%
- Certificate expiring in 30 days
- Provisioning taking > 10 minutes

**Notification Channels**:
- Slack (#alerts channel)
- PagerDuty (for critical alerts)
- Email notifications

**Silencing Alerts**:
```bash
# Silence an alert for maintenance
curl -X POST http://alertmanager:9093/api/v1/silences \
  -H 'Content-Type: application/json' \
  -d '{
    "matchers": [
      {"name": "alertname", "value": "StoreDown", "isRegex": false}
    ],
    "startsAt": "2024-01-15T10:00:00Z",
    "endsAt": "2024-01-15T12:00:00Z",
    "createdBy": "platform-team",
    "comment": "Scheduled maintenance"
  }'
```

## Deployment

### Quick Start

```bash
# Install observability stack
make install-observability

# Or manually:
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo add grafana https://grafana.github.io/helm-charts
helm repo update

helm dependency update helm/observability
helm upgrade --install observability helm/observability \
  --namespace observability \
  --create-namespace \
  --values helm/observability/values.yaml \
  --wait --timeout 10m
```

### Verify Installation

```bash
# Check all pods are running
kubectl get pods -n observability

# Expected output:
# NAME                                       READY   STATUS
# observability-grafana-xxx                   1/1     Running
# observability-loki-0                        1/1     Running
# observability-prometheus-alertmanager-xxx   1/1     Running
# observability-prometheus-server-xxx         1/1     Running
# observability-promtail-xxx                  1/1     Running

# Check services
kubectl get svc -n observability

# Test Prometheus
curl http://localhost:9090/api/v1/status/targets

# Test Grafana
curl http://localhost:3000/api/health
```

## Usage Examples

### Viewing API Performance

1. **In Grafana**:
   - Navigate to "Platform Overview" dashboard
   - View "API Request Rate" and "API Latency" panels
   - Filter by status code or endpoint

2. **In Prometheus**:
   ```promql
   # Request rate by endpoint
   rate(store_platform_http_requests_total[5m]) by (route)
   
   # Error rate
   rate(store_platform_http_requests_total{status_code=~"5.."}[5m])
   ```

### Monitoring Store Health

1. **Active Stores**:
   ```promql
   store_platform_active_stores_total
   ```

2. **Provisioning Duration**:
   ```promql
   histogram_quantile(0.95, 
     rate(store_platform_provisioning_duration_seconds_bucket[15m])
   )
   ```

3. **Failed Operations**:
   ```promql
   rate(store_platform_store_operations_total{status="failed"}[5m])
   ```

### Log Analysis

1. **Search API Errors**:
   - In Grafana: Go to Explore → Select Loki datasource
   - Query: `{app="api", level="error"}`

2. **Find Slow Queries**:
   ```logql
   {app="api"} 
   | json 
   | response_time > 2000
   | line_format "{{.timestamp}} - {{.method}} {{.path}} - {{.response_time}}ms"
   ```

3. **Store-specific Logs**:
   ```logql
   {namespace="store-abc-123"}
   ```

## Alert Response

### Receiving Alerts

When an alert fires, you'll receive:

**Slack Notification**:
```
🔴 CRITICAL: APIHighErrorRate
Error rate is 0.15 errors per second
Runbook: https://wiki/runbooks/api-errors
Dashboard: http://grafana/d/api-errors
Silence: http://alertmanager/#/silences/new?filter=alertname%3DAPIHighErrorRate
```

**PagerDuty Alert** (Critical only):
- Incident created automatically
- On-call engineer notified
- Escalation policy applied if not acknowledged

### Responding to Alerts

1. **Acknowledge**: Click "Acknowledge" in notification to stop escalation
2. **Investigate**: Use provided dashboard and runbook links
3. **Resolve**: Fix the underlying issue
4. **Document**: Add notes to incident for post-mortem

### Common Alert Scenarios

**APIHighErrorRate**:
```bash
# Check API logs
kubectl logs -n store-platform -l app=api --tail=500

# Check recent deployments
kubectl rollout history deployment/api -n store-platform

# Restart if needed
kubectl rollout restart deployment/api -n store-platform
```

**StoreDown**:
```bash
# Check store namespace
kubectl get pods -n store-<id>

# View logs
kubectl logs -n store-<id> -l component=wordpress --tail=100

# Check events
kubectl get events -n store-<id> --sort-by='.lastTimestamp'
```

## Maintenance

### Retention Policies

**Metrics**: 15 days (configurable in Prometheus)
**Logs**: 7 days (configurable in Loki)
**Dashboards**: Persistent storage

### Cleanup

```bash
# Remove old metrics (automatic)
# Prometheus handles retention automatically

# Compact Loki logs
kubectl exec -it observability-loki-0 -n observability -- \
  curl -X POST http://localhost:3100/loki/api/v1/admin/compact
```

### Backup

```bash
# Backup Grafana dashboards
kubectl exec -it observability-grafana-xxx -n observability -- \
  tar czf - /var/lib/grafana/dashboards > grafana-dashboards-backup.tar.gz

# Backup Prometheus data (if needed)
kubectl cp observability/prometheus-data:/prometheus ./prometheus-backup
```

## Troubleshooting

### Prometheus Not Scraping Targets

```bash
# Check targets
kubectl port-forward svc/observability-prometheus-server 9090:80 -n observability
open http://localhost:9090/targets

# Check service discovery
open http://localhost:9090/service-discovery

# Verify pod annotations
kubectl get pod <pod-name> -o yaml | grep -A 5 annotations
```

### Loki Not Receiving Logs

```bash
# Check Promtail status
kubectl logs -n observability -l app.kubernetes.io/name=promtail

# Check Loki readiness
kubectl exec -it observability-loki-0 -n observability -- \
  wget -qO- http://localhost:3100/ready

# Verify log stream
kubectl exec -it observability-loki-0 -n observability -- \
  curl "http://localhost:3100/loki/api/v1/label/namespace/values"
```

### Grafana Datasource Errors

```bash
# Test datasource connection
kubectl exec -it observability-grafana-xxx -n observability -- \
  curl http://observability-prometheus-server:9090/api/v1/status/config

# Restart Grafana
kubectl rollout restart deployment/observability-grafana -n observability
```

## Best Practices

### 1. Metric Cardinality
- Avoid high cardinality labels (e.g., user IDs, timestamps)
- Use bounded sets for labels (engine type, plan type)
- Monitor label cardinality: `prometheus_tsdb_head_series`

### 2. Alert Thresholds
- Set thresholds based on historical data
- Use percentile-based alerts for latency
- Include "for" duration to reduce noise

### 3. Dashboard Organization
- Group related panels
- Use consistent time ranges
- Add descriptions to panels
- Use variables for filtering

### 4. Log Volume
- Log at appropriate levels
- Use structured logging (JSON)
- Include correlation IDs
- Sample high-volume logs

## Resources

- **Prometheus**: https://prometheus.io/docs/
- **Grafana**: https://grafana.com/docs/
- **Loki**: https://grafana.com/docs/loki/
- **Alertmanager**: https://prometheus.io/docs/alerting/

---

*For support, contact the Platform Team*
