# Runbook

## Overview

This runbook provides operational procedures for the Store Provisioning Platform, including common failure scenarios, debugging steps, and recovery procedures.

## Quick Reference

### Essential Commands

```bash
# Platform status
kubectl get pods -n store-platform
kubectl get svc -n store-platform
kubectl get ingress -n store-platform

# List all stores
kubectl get namespaces -l app.kubernetes.io/part-of=store-platform

# View store resources
kubectl get all -n store-<id>

# Check provisioner logs
kubectl logs -n store-platform deployment/provisioner -f

# Restart provisioner
kubectl rollout restart deployment/provisioner -n store-platform

# Helm operations
helm list -n store-platform
helm status store-platform -n store-platform
helm get values store-platform -n store-platform
```

## Common Failure Scenarios

### Scenario 1: Store Stuck in "Provisioning" State

**Symptoms:**
- Store creation initiated but status remains "Provisioning" for > 10 minutes
- Dashboard shows progress bar stuck
- User cannot access store URL

**Diagnosis Steps:**

```bash
# 1. Check store namespace
kubectl get namespace store-<store-id>

# 2. Check Helm release status
helm status store-<store-id> -n store-<store-id>

# 3. Check pods in store namespace
kubectl get pods -n store-<store-id>

# 4. Check pod events
kubectl get events -n store-<store-id> --sort-by='.lastTimestamp'

# 5. Check pod logs
kubectl logs -n store-<store-id> deployment/<store-name>-app
kubectl logs -n store-<store-id> statefulset/<store-name>-db

# 6. Check provisioner logs
kubectl logs -n store-platform deployment/provisioner | grep <store-id>
```

**Common Causes & Fixes:**

| Cause | Fix |
|-------|-----|
| Image pull error | Check image registry access; verify image tag exists |
| PVC pending | Check storage class; verify PV availability |
| Database not ready | Check DB pod logs; verify credentials |
| Resource constraints | Check node resources; scale up cluster |
| Init container failing | Check init container logs; verify dependencies |

**Recovery:**

```bash
# Option 1: Retry provisioning (if namespace exists)
kubectl delete job <init-job-name> -n store-<store-id>
# Provisioner will retry automatically

# Option 2: Force re-provisioning
helm uninstall store-<store-id> -n store-<store-id>
kubectl delete namespace store-<store-id>
# Trigger provision again via API

# Option 3: Manual completion
# If resources are healthy but status is wrong:
curl -X PATCH http://api.127.0.0.1.nip.io/api/v1/stores/<store-id> \
  -H "Content-Type: application/json" \
  -d '{"status": "running"}'
```

### Scenario 2: Store URL Not Accessible

**Symptoms:**
- Store shows "Running" status
- Browser shows 404 or connection refused
- Ingress not routing traffic

**Diagnosis Steps:**

```bash
# 1. Verify ingress exists
kubectl get ingress -n store-<store-id>

# 2. Check ingress details
kubectl describe ingress -n store-<store-id>

# 3. Verify service endpoints
kubectl get endpoints -n store-<store-id>

# 4. Check ingress controller logs
kubectl logs -n ingress-nginx deployment/ingress-nginx-controller

# 5. Test connectivity from within cluster
kubectl run -it --rm debug --image=curlimages/curl --restart=Never -- \
  curl http://<store-name>-app.store-<store-id>.svc.cluster.local

# 6. Check DNS resolution
nslookup <store-name>.127.0.0.1.nip.io
# or for production
nslookup <store-name>.stores.example.com
```

**Common Causes & Fixes:**

| Cause | Fix |
|-------|-----|
| Ingress not created | Check provisioner logs; re-run helm install |
| Service selector mismatch | Verify pod labels match service selector |
| Ingress controller down | Restart ingress controller pod |
| DNS not resolving | Check /etc/hosts (local) or DNS records (prod) |
| TLS certificate issue | Check cert-manager; verify certificate status |

**Recovery:**

```bash
# Recreate ingress
kubectl delete ingress -n store-<store-id> <store-name>
helm upgrade store-<store-id> ./helm-charts/store-instance \
  -n store-<store-id> \
  --set ingress.host=<correct-host>

# Restart ingress controller
kubectl rollout restart deployment/ingress-nginx-controller -n ingress-nginx

# Force certificate renewal
kubectl delete certificate -n store-<store-id> <store-name>-tls
kubectl delete secret -n store-<store-id> <store-name>-tls
# cert-manager will recreate automatically
```

### Scenario 3: Database Connection Failures

**Symptoms:**
- Application pods in CrashLoopBackOff
- Logs show "connection refused" or "access denied"
- Store inaccessible

**Diagnosis Steps:**

```bash
# 1. Check database pod status
kubectl get pods -n store-<store-id> -l app=<store-name>-db

# 2. Check database logs
kubectl logs -n store-<store-id> statefulset/<store-name>-db

# 3. Verify secrets
kubectl get secret -n store-<store-id> <store-name>-db-credentials -o yaml

# 4. Test database connectivity
kubectl run -it --rm debug --image=mysql:8.0 --restart=Never -- \
  mysql -h <store-name>-db -u wordpress -p

# 5. Check PVC status
kubectl get pvc -n store-<store-id>

# 6. Check events
kubectl get events -n store-<store-id> --field-selector reason=FailedMount
```

**Common Causes & Fixes:**

| Cause | Fix |
|-------|-----|
| Wrong credentials | Regenerate secrets; update application env vars |
| Database not initialized | Check init job logs; re-run init |
| PVC not bound | Check storage class; verify PV availability |
| Data corruption | Restore from backup; or recreate store |
| Resource exhaustion | Check node resources; add more capacity |

**Recovery:**

```bash
# Reset database password
kubectl delete secret -n store-<store-id> <store-name>-db-credentials
# Trigger secret regeneration via provisioner

# Force database re-initialization
kubectl delete statefulset -n store-<store-id> <store-name>-db
kubectl delete pvc -n store-<store-id> data-<store-name>-db-0
helm upgrade store-<store-id> ./helm-charts/store-instance \
  -n store-<store-id>

# Restore from backup (if available)
# Follow backup restore procedure below
```

### Scenario 4: Provisioner API Unresponsive

**Symptoms:**
- Dashboard shows error messages
- Store creation requests timeout
- API endpoints return 500 errors

**Diagnosis Steps:**

```bash
# 1. Check provisioner pod status
kubectl get pods -n store-platform -l app.kubernetes.io/name=provisioner

# 2. Check provisioner logs
kubectl logs -n store-platform deployment/provisioner --tail=100

# 3. Check resource usage
kubectl top pod -n store-platform

# 4. Check provisioner database
kubectl exec -it -n store-platform deployment/provisioner -- \
  psql -h provisioner-db -U provisioner -d provisioner -c "SELECT COUNT(*) FROM stores;"

# 5. Check events
kubectl get events -n store-platform --field-selector involvedObject.name=provisioner
```

**Common Causes & Fixes:**

| Cause | Fix |
|-------|-----|
| High load | Scale up provisioner replicas |
| Database connection pool exhausted | Restart provisioner; check DB connections |
| Memory leak | Restart provisioner pods |
| Disk full | Clean up logs; expand PVC |
| Helm operation stuck | Cancel stuck Helm operations |

**Recovery:**

```bash
# Scale up provisioner
kubectl scale deployment/provisioner -n store-platform --replicas=3

# Restart provisioner
kubectl rollout restart deployment/provisioner -n store-platform

# Check and kill stuck Helm operations
helm list -n store-<store-id> --pending
# If stuck, manually delete release secret
kubectl delete secret -n store-<store-id> sh.helm.release.v1.store-<store-id>.v1

# Clear job queue (if using Redis)
kubectl exec -it -n store-platform deployment/redis -- redis-cli FLUSHDB
```

### Scenario 5: Store Deletion Fails

**Symptoms:**
- Delete operation initiated but store still appears
- Status stuck on "Deleting"
- Resources not cleaned up

**Diagnosis Steps:**

```bash
# 1. Check store status in API
curl http://api.127.0.0.1.nip.io/api/v1/stores/<store-id>

# 2. Check namespace status
kubectl get namespace store-<store-id>

# 3. Check for finalizers
kubectl get namespace store-<store-id> -o yaml | grep -A 5 finalizers

# 4. Check for stuck resources
kubectl get all -n store-<store-id>

# 5. Check Helm release
helm list -n store-<store-id> --all

# 6. Check provisioner logs
kubectl logs -n store-platform deployment/provisioner | grep -i delete
```

**Common Causes & Fixes:**

| Cause | Fix |
|-------|-----|
| PVC protection | Remove finalizers from PVC |
| Namespace finalizers stuck | Force remove finalizers |
| Helm release stuck | Manually delete Helm release |
| Background jobs running | Wait for jobs to complete |
| RBAC issues | Check provisioner service account permissions |

**Recovery:**

```bash
# Force delete namespace
kubectl delete namespace store-<store-id> --force --grace-period=0

# Remove finalizers manually
kubectl patch namespace store-<store-id> -p '{"metadata":{"finalizers":[]}}' --type=merge

# Clean up orphaned resources
kubectl delete all --all -n store-<store-id> --force --grace-period=0
kubectl delete pvc --all -n store-<store-id> --force --grace-period=0

# Update provisioner database manually (if needed)
kubectl exec -it -n store-platform deployment/provisioner -- \
  psql -h provisioner-db -U provisioner -d provisioner \
  -c "DELETE FROM stores WHERE id = '<store-id>';"
```

## Debugging Commands

### Log Inspection

```bash
# Follow logs in real-time
kubectl logs -f -n store-platform deployment/provisioner

# Get logs from previous container (after restart)
kubectl logs -n store-<store-id> deployment/<store-name>-app --previous

# Get logs from all containers in a pod
kubectl logs -n store-<store-id> <pod-name> --all-containers

# Get logs from specific container
kubectl logs -n store-<store-id> <pod-name> -c <container-name>

# Get logs with timestamps
kubectl logs -n store-<store-id> <pod-name> --timestamps

# Get last N lines
kubectl logs -n store-<store-id> <pod-name> --tail=100

# Get logs since specific time
kubectl logs -n store-<store-id> <pod-name> --since=1h
```

### Resource Inspection

```bash
# Describe pod (shows events and status)
kubectl describe pod -n store-<store-id> <pod-name>

# Describe deployment
kubectl describe deployment -n store-<store-id> <deployment-name>

# Describe ingress
kubectl describe ingress -n store-<store-id> <ingress-name>

# Get detailed resource info
kubectl get pod -n store-<store-id> <pod-name> -o yaml

# Get resource usage
kubectl top pod -n store-<store-id>
kubectl top node

# Get resource quotas
kubectl describe resourcequota -n store-<store-id>

# Check network policies
kubectl get networkpolicy -n store-<store-id> -o yaml
```

### Network Debugging

```bash
# Test DNS resolution
kubectl run -it --rm debug --image=busybox:1.36 --restart=Never -- nslookup kubernetes.default

# Test service connectivity
kubectl run -it --rm debug --image=curlimages/curl --restart=Never -- \
  curl -v http://<service-name>.<namespace>.svc.cluster.local

# Port forward for local testing
kubectl port-forward -n store-<store-id> svc/<service-name> 8080:80

# Check service endpoints
kubectl get endpoints -n store-<store-id>

# Check ingress rules
kubectl get ingress -n store-<store-id> -o yaml

# Check certificate status
kubectl get certificate -n store-<store-id>
kubectl describe certificate -n store-<store-id> <cert-name>
```

### Helm Debugging

```bash
# Template rendering with debug
helm template store-platform ./helm-charts/store-platform \
  -f ./helm-charts/store-platform/values-local.yaml \
  --debug

# Dry run installation
helm install store-platform ./helm-charts/store-platform \
  -f ./helm-charts/store-platform/values-local.yaml \
  --dry-run \
  --debug

# Get release values
helm get values store-platform -n store-platform --all

# Get release manifest
helm get manifest store-platform -n store-platform

# Get release notes
helm get notes store-platform -n store-platform

# History of release
helm history store-platform -n store-platform

# Test release
helm test store-platform -n store-platform
```

## Recovery Procedures

### Recover Failed Provisioning

```bash
# Step 1: Identify failed store
kubectl get namespaces -l app.kubernetes.io/part-of=store-platform
kubectl get stores -n store-platform  # If CRD exists

# Step 2: Diagnose issue
kubectl get events -n store-<store-id> --sort-by='.lastTimestamp'
kubectl logs -n store-<store-id> --all-containers

# Step 3: Attempt repair based on issue type
# See specific scenarios above

# Step 4: If unrecoverable, force delete and recreate
helm uninstall store-<store-id> -n store-<store-id> || true
kubectl delete namespace store-<store-id> --force --grace-period=0 || true

# Step 5: Clean up provisioner state
curl -X DELETE http://api.127.0.0.1.nip.io/api/v1/stores/<store-id>

# Step 6: Recreate store via dashboard or API
```

### Data Persistence and Restore

#### Backup Strategy

```bash
# Automated backup script
#!/bin/bash
STORE_ID=$1
BACKUP_DIR=/backups/$STORE_ID/$(date +%Y%m%d_%H%M%S)
mkdir -p $BACKUP_DIR

# Backup database
kubectl exec -n store-$STORE_ID statefulset/${STORE_ID}-db -- \
  mysqldump -u root -p$(kubectl get secret -n store-$STORE_ID ${STORE_ID}-db-credentials -o jsonpath='{.data.root-password}' | base64 -d) \
  wordpress > $BACKUP_DIR/database.sql

# Backup uploads
kubectl cp store-$STORE_ID/${STORE_ID}-app-xxx:/var/www/html/wp-content/uploads $BACKUP_DIR/uploads

# Backup configuration
kubectl get configmap -n store-$STORE_ID -o yaml > $BACKUP_DIR/configmaps.yaml
kubectl get secret -n store-$STORE_ID -o yaml > $BACKUP_DIR/secrets.yaml

echo "Backup completed: $BACKUP_DIR"
```

#### Restore Procedure

```bash
#!/bin/bash
STORE_ID=$1
BACKUP_PATH=$2

# Step 1: Create store (without data)
# Use API or dashboard

# Step 2: Restore database
kubectl cp $BACKUP_PATH/database.sql store-$STORE_ID/restore.sql
kubectl exec -n store-$STORE_ID statefulset/${STORE_ID}-db -- \
  mysql -u root -p$(kubectl get secret -n store-$STORE_ID ${STORE_ID}-db-credentials -o jsonpath='{.data.root-password}' | base64 -d) \
  wordpress < /restore.sql

# Step 3: Restore uploads
kubectl cp $BACKUP_PATH/uploads store-$STORE_ID/${STORE_ID}-app-xxx:/var/www/html/wp-content/

# Step 4: Verify
kubectl exec -n store-$STORE_ID deployment/${STORE_ID}-app -- \
  curl -f http://localhost/wp-includes/images/blank.gif

echo "Restore completed for store: $STORE_ID"
```

### Safe Teardown and Cleanup

#### Graceful Platform Shutdown

```bash
#!/bin/bash
# graceful-shutdown.sh

echo "Starting graceful shutdown..."

# Step 1: Prevent new store creation
kubectl patch configmap -n store-platform provisioner-config \
  --patch '{"data":{"CREATE_ENABLED":"false"}}'

# Step 2: Get list of all stores
STORES=$(kubectl get namespaces -l app.kubernetes.io/part-of=store-platform -o jsonpath='{.items[*].metadata.name}')

# Step 3: Backup all stores
for store in $STORES; do
  echo "Backing up $store..."
  ./scripts/backup-store.sh ${store#store-}
done

# Step 4: Delete all stores
for store in $STORES; do
  echo "Deleting $store..."
  STORE_ID=${store#store-}
  helm uninstall store-$STORE_ID -n $store || true
  kubectl delete namespace $store --wait=false
done

# Step 5: Wait for deletion
sleep 30

# Step 6: Force delete stuck namespaces
for store in $STORES; do
  kubectl patch namespace $store -p '{"metadata":{"finalizers":[]}}' --type=merge || true
  kubectl delete namespace $store --force --grace-period=0 || true
done

# Step 7: Delete platform
helm uninstall store-platform -n store-platform
kubectl delete namespace store-platform

echo "Graceful shutdown completed"
```

#### Emergency Cleanup

```bash
#!/bin/bash
# emergency-cleanup.sh
# WARNING: This will delete ALL store data!

echo "WARNING: This will delete ALL stores and data!"
read -p "Are you sure? (yes/no): " confirm
if [ "$confirm" != "yes" ]; then
    echo "Aborted"
    exit 1
fi

# Delete all store namespaces
kubectl get namespaces -l app.kubernetes.io/part-of=store-platform -o name | \
  xargs -I {} kubectl delete {} --force --grace-period=0

# Delete platform
helm list -n store-platform --short | xargs helm uninstall -n store-platform
kubectl delete namespace store-platform --force --grace-period=0

# Clean up PVs (if retention is Delete)
kubectl get pv | grep Released | awk '{print $1}' | xargs kubectl delete pv

echo "Emergency cleanup completed"
```

## Monitoring and Alerting

### Key Metrics to Monitor

```yaml
# Prometheus alerts
alerts:
  - name: StoreProvisioningFailed
    expr: store_provisioning_failures_total > 0
    for: 5m
    severity: critical
    
  - name: HighErrorRate
    expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.1
    for: 5m
    severity: warning
    
  - name: StoreDown
    expr: store_up == 0
    for: 2m
    severity: critical
    
  - name: DiskSpaceLow
    expr: (kubelet_volume_stats_available_bytes / kubelet_volume_stats_capacity_bytes) < 0.1
    for: 5m
    severity: warning
    
  - name: MemoryHigh
    expr: container_memory_usage_bytes / container_spec_memory_limit_bytes > 0.9
    for: 5m
    severity: warning
```

### Log Aggregation

```bash
# Export logs for analysis
kubectl logs -n store-platform deployment/provisioner --since=24h > provisioner-logs.txt

# Search for errors
kubectl logs -n store-platform deployment/provisioner | grep -i error

# Aggregate logs from all stores
for ns in $(kubectl get ns -l app.kubernetes.io/part-of=store-platform -o name); do
  echo "=== $ns ===" >> all-stores-logs.txt
  kubectl logs -n ${ns#namespace/} --all-containers --since=1h >> all-stores-logs.txt 2>&1
done
```

## Performance Tuning

### Resource Optimization

```bash
# Check resource usage
kubectl top pod --all-namespaces

# Identify over-provisioned stores
kubectl top pod -n store-<store-id>

# Adjust resource limits
kubectl patch deployment -n store-<store-id> <store-name>-app -p '{"spec":{"template":{"spec":{"containers":[{"name":"wordpress","resources":{"limits":{"memory":"512Mi"}}}]}}}}'

# Scale down during low usage
kubectl scale deployment -n store-<store-id> <store-name>-app --replicas=0
# Scale up when needed
kubectl scale deployment -n store-<store-id> <store-name>-app --replicas=1
```

### Database Optimization

```bash
# Check slow queries (MySQL)
kubectl exec -it -n store-<store-id> statefulset/<store-name>-db -- \
  mysql -u root -p -e "SELECT * FROM mysql.slow_log ORDER BY start_time DESC LIMIT 10;"

# Optimize tables
kubectl exec -it -n store-<store-id> statefulset/<store-name>-db -- \
  mysql -u root -p -e "OPTIMIZE TABLE wp_posts, wp_postmeta, wp_options;"

# Clear transients (WordPress)
kubectl exec -it -n store-<store-id> deployment/<store-name>-app -- \
  wp transient delete --expired --allow-root
```

## Contact and Escalation

### Internal Escalation

1. **Level 1:** Check runbook, attempt basic fixes
2. **Level 2:** Complex issues, data recovery
3. **Level 3:** Platform architecture issues

### External Resources

- Kubernetes Documentation: https://kubernetes.io/docs/
- Helm Documentation: https://helm.sh/docs/
- WooCommerce Documentation: https://docs.woocommerce.com/
- Community Support: GitHub Issues

## Document Maintenance

**Version:** 1.0  
**Last Updated:** 2024-01-15  
**Next Review:** 2024-04-15  
**Owner:** Platform Engineering Team

**Change Log:**
- 2024-01-15: Initial version
