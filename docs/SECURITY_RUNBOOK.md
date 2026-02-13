# Store Provisioning Platform - Security Runbook

## Table of Contents
1. [Security Overview](#security-overview)
2. [Incident Response](#incident-response)
3. [Vulnerability Management](#vulnerability-management)
4. [Secret Management](#secret-management)
5. [Access Control](#access-control)
6. [Network Security](#network-security)
7. [Compliance](#compliance)
8. [Emergency Procedures](#emergency-procedures)

---

## Security Overview

### Security Architecture
The Store Provisioning Platform implements defense-in-depth security:

- **Namespace Isolation**: Each store runs in its own Kubernetes namespace
- **Network Policies**: Restrict traffic between stores and external access
- **Pod Security**: Non-root containers, read-only filesystems where possible
- **Secret Management**: Kubernetes Secrets with automatic rotation capability
- **RBAC**: Least-privilege access for service accounts
- **Image Scanning**: Automated vulnerability scanning with Trivy

### Security Contacts
- Security Team: security@example.com
- On-Call: oncall@example.com
- Escalation: escalation@example.com

---

## Incident Response

### Severity Levels

#### Critical (P0)
- Active data breach
- Ransomware attack
- Complete platform outage due to security issue
- Unauthorized admin access

**Response Time**: Immediate (< 15 minutes)

#### High (P1)
- Potential data exposure
- DDoS attack affecting availability
- Malware detection
- Privilege escalation vulnerability

**Response Time**: < 1 hour

#### Medium (P2)
- Vulnerability with no known exploit
- Policy violation
- Failed security scan

**Response Time**: < 24 hours

#### Low (P3)
- Security hygiene issues
- Documentation gaps
- Minor configuration drift

**Response Time**: < 1 week

### Incident Response Playbook

1. **Detect**
   - Monitor security alerts from:
     - Trivy image scans
     - Kubernetes audit logs
     - Platform monitoring
     - User reports

2. **Assess**
   - Determine severity level
   - Identify affected systems
   - Assess blast radius
   - Document initial findings

3. **Contain**
   - Isolate affected stores
   - Revoke compromised credentials
   - Block malicious traffic
   - Preserve evidence

4. **Eradicate**
   - Remove threat actor access
   - Patch vulnerabilities
   - Clean infected systems
   - Rotate secrets

5. **Recover**
   - Restore from clean backups
   - Verify system integrity
   - Restore service gradually
   - Monitor for re-infection

6. **Post-Incident**
   - Document timeline
   - Conduct root cause analysis
   - Update security controls
   - Share lessons learned

---

## Vulnerability Management

### Automated Scanning

#### Trivy Image Scanning
- **Frequency**: Every build
- **Scope**: All container images
- **Location**: GitHub Actions CI/CD
- **Reporting**: GitHub Security tab

#### Kubernetes Security Scanning
```bash
# Install kube-bench
kubectl apply -f https://raw.githubusercontent.com/aquasecurity/kube-bench/main/job.yaml

# Run CIS benchmark
kubectl logs -n default job/kube-bench
```

### Vulnerability Remediation SLA

| Severity | Remediation Time |
|----------|------------------|
| Critical | 24 hours |
| High | 7 days |
| Medium | 30 days |
| Low | 90 days |

### Manual Scanning Commands

```bash
# Scan specific image
trivy image ghcr.io/your-org/dashboard:latest

# Scan running pods
kubectl get pods --all-namespaces -o json | trivy kubernetes -

# Scan Helm charts
trivy config ./helm/
```

---

## Secret Management

### Secret Rotation

#### Automatic Rotation
The following secrets are automatically rotated:
- Store database passwords (on store recreation)
- WordPress admin passwords
- WordPress salts

#### Manual Rotation Procedure

1. **Database Passwords**
```bash
# Generate new password
NEW_PASSWORD=$(openssl rand -base64 32)

# Update secret
kubectl patch secret store-<id>-mysql-credentials \
  -n store-<id> \
  --type='json' \
  -p='[{"op": "replace", "path": "/data/password", "value":"'$(echo -n $NEW_PASSWORD | base64)'"}]'

# Restart MySQL pod
kubectl rollout restart statefulset mysql -n store-<id>
```

2. **API Keys/Tokens**
```bash
# Rotate API token
kubectl patch secret api-secrets \
  -n store-platform \
  --type='json' \
  -p='[{"op": "replace", "path": "/data/api-token", "value":"'$(echo -n $NEW_TOKEN | base64)'"}]'
```

### Secret Auditing

```bash
# List all secrets
kubectl get secrets --all-namespaces

# Check secret age
kubectl get secrets --all-namespaces -o json | \
  jq '.items[] | select(.metadata.creationTimestamp < "2024-01-01T00:00:00Z") | .metadata.name'

# Audit secret access
kubectl audit-log --resource=secrets
```

---

## Access Control

### RBAC Review

```bash
# List all service accounts
kubectl get serviceaccounts --all-namespaces

# Check cluster roles
kubectl get clusterroles

# Check role bindings
kubectl get rolebindings,clusterrolebindings --all-namespaces

# Verify least privilege
kubectl auth can-i --list --as=system:serviceaccount:store-platform:provisioner
```

### Access Review Checklist

- [ ] Service accounts have minimal required permissions
- [ ] No cluster-admin bindings for application accounts
- [ ] Regular review of user access (quarterly)
- [ ] Removed access for departed team members
- [ ] MFA enabled for all human accounts

---

## Network Security

### Network Policy Verification

```bash
# Check network policies
kubectl get networkpolicies --all-namespaces

# Test connectivity between namespaces
kubectl run test-pod --rm -it --image=nicolaka/netshoot -- /bin/bash

# Inside test pod:
nc -zv store-<id>-wordpress 80
```

### Firewall Rules

Default deny-all policy is applied to all store namespaces:
- Only ingress from nginx-ingress allowed
- MySQL only accessible from WordPress pods
- External egress limited to HTTP/HTTPS

### DDoS Protection

1. **Rate Limiting**
   - Implemented at ingress level
   - Default: 100 req/min per IP
   - Configurable per store

2. **Resource Limits**
   - CPU/Memory limits on all pods
   - Prevents resource exhaustion

---

## Compliance

### CIS Kubernetes Benchmark

Regular audits against CIS benchmarks:

```bash
# Run CIS benchmark
kubectl apply -f https://raw.githubusercontent.com/aquasecurity/kube-bench/main/job.yaml
kubectl logs job/kube-bench
```

### Security Controls

| Control | Implementation | Status |
|---------|---------------|--------|
| Network Segmentation | Namespace + Network Policies | ✅ |
| Secret Encryption | Kubernetes Secrets + etcd encryption | ✅ |
| Container Security | Non-root, read-only root FS | ✅ |
| Image Scanning | Trivy in CI/CD | ✅ |
| RBAC | Least privilege | ✅ |
| Audit Logging | Kubernetes audit logs | ✅ |
| Backup Encryption | Encrypted backups | ✅ |

---

## Emergency Procedures

### Platform-Wide Security Incident

1. **Immediate Actions**
```bash
# Enable maintenance mode
kubectl patch configmap platform-config -n store-platform --type merge \
  -p '{"data":{"maintenance_mode":"true"}}'

# Scale down all stores
kubectl get namespaces -l store-platform/type=store -o name | \
  xargs -I {} kubectl scale deployment --all --replicas=0 -n {}
```

2. **Preserve Evidence**
```bash
# Collect logs
kubectl logs --all-containers --all-namespaces --since=24h > /tmp/incident-logs.txt

# Export Kubernetes events
kubectl get events --all-namespaces -o yaml > /tmp/incident-events.yaml

# Snapshot etcd (if direct access)
etcdctl snapshot save /tmp/etcd-snapshot.db
```

3. **Communication**
   - Notify security team immediately
   - Update status page
   - Prepare stakeholder communication
   - Document all actions taken

### Store Compromise Response

1. **Isolate Store**
```bash
# Delete network policies to isolate
kubectl delete networkpolicy --all -n store-<id>

# Scale down store
kubectl scale deployment wordpress --replicas=0 -n store-<id>
```

2. **Investigate**
```bash
# Get pod logs
kubectl logs deployment/wordpress -n store-<id> --previous

# Check for unauthorized access
kubectl exec -it deployment/wordpress -n store-<id> -- /bin/bash
# Inside container:
last
cat /var/log/apache2/access.log
```

3. **Rebuild Store**
```bash
# Delete and recreate (preserving data)
helm uninstall store-<id> -n store-<id>
# Recreate from backup
```

---

## Security Checklists

### Pre-Deployment Security Checklist

- [ ] Image scanned with Trivy (no critical/high vulnerabilities)
- [ ] Secrets not hardcoded in manifests
- [ ] Network policies configured
- [ ] Resource limits set
- [ ] Security contexts applied
- [ ] RBAC permissions reviewed
- [ ] Health checks configured

### Quarterly Security Review

- [ ] Review all RBAC bindings
- [ ] Audit secret ages and rotate if > 90 days
- [ ] Review network policies
- [ ] Run CIS benchmark
- [ ] Review access logs
- [ ] Update base images
- [ ] Review security alerts
- [ ] Update security runbook

---

## Security Resources

### Documentation
- [Kubernetes Security Best Practices](https://kubernetes.io/docs/concepts/security/)
- [CIS Kubernetes Benchmark](https://www.cisecurity.org/benchmark/kubernetes)
- [NIST Container Security Guide](https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-190.pdf)

### Tools
- Trivy: https://github.com/aquasecurity/trivy
- kube-bench: https://github.com/aquasecurity/kube-bench
- kubectl-who-can: https://github.com/aquasecurity/kubectl-who-can

---

*Last Updated: 2024*
*Version: 1.0*
*Owner: Security Team*
