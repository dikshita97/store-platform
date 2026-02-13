# Security and Secrets Management

## Overview

This document outlines the security model, secrets management strategy, and hardening practices for the Store Provisioning Platform. Security is implemented at multiple layers: application, Kubernetes, network, and infrastructure.

## Security Model

### Defense in Depth

```
┌─────────────────────────────────────────────────────────────┐
│                    Perimeter Security                        │
│         (TLS, WAF, Rate Limiting, DDoS Protection)          │
├─────────────────────────────────────────────────────────────┤
│                    Ingress Layer                             │
│         (nginx-ingress, cert-manager, Network Policies)     │
├─────────────────────────────────────────────────────────────┤
│                    Application Layer                         │
│         (Authentication, Authorization, Input Validation)   │
├─────────────────────────────────────────────────────────────┤
│                    Container Layer                           │
│         (Non-root containers, Security Contexts, Limits)    │
├─────────────────────────────────────────────────────────────┤
│                    Data Layer                                │
│         (Encrypted volumes, Secrets, Database encryption)   │
├─────────────────────────────────────────────────────────────┤
│                    Infrastructure Layer                      │
│         (Node security, OS hardening, Network isolation)    │
└─────────────────────────────────────────────────────────────┘
```

### Security Principles

1. **Principle of Least Privilege:** Minimal permissions for all components
2. **Defense in Depth:** Multiple security layers
3. **Zero Trust:** Verify every request, encrypt all traffic
4. **Secrets Management:** No hardcoded secrets, automated rotation
5. **Isolation:** Namespace-per-store with strict boundaries
6. **Observability:** Comprehensive audit logging

## Secrets Strategy

### Secret Types

| Secret Type | Storage | Rotation | Access Pattern |
|-------------|---------|----------|----------------|
| Database Credentials | Kubernetes Secret | On recreation | Pod env vars |
| API Keys | Kubernetes Secret | Manual | Pod env vars |
| TLS Certificates | cert-manager | Auto (90 days) | Ingress annotations |
| Application Salts | Kubernetes Secret | On recreation | Pod env vars |
| Admin Passwords | Kubernetes Secret + Email | User-initiated | Dashboard display |

### Kubernetes Secrets

All runtime secrets are stored as Kubernetes Secrets:

```yaml
# Database credentials
apiVersion: v1
kind: Secret
metadata:
  name: store-abc123-db-credentials
  namespace: store-abc123
type: Opaque
data:
  root-password: <base64-encoded>
  password: <base64-encoded>
---
# Application credentials
apiVersion: v1
kind: Secret
metadata:
  name: store-abc123-app-credentials
  namespace: store-abc123
type: Opaque
data:
  admin-password: <base64-encoded>
  auth-key: <base64-encoded>
  auth-salt: <base64-encoded>
```

### Secret Generation

Secrets are auto-generated during provisioning:

```javascript
// Provisioner secret generation
const crypto = require('crypto');

function generatePassword(length = 32) {
  return crypto.randomBytes(length)
    .toString('base64')
    .slice(0, length)
    .replace(/[^a-zA-Z0-9]/g, '');
}

function generateWordPressSalts() {
  const salts = {};
  const saltNames = [
    'AUTH_KEY', 'SECURE_AUTH_KEY', 'LOGGED_IN_KEY', 'NONCE_KEY',
    'AUTH_SALT', 'SECURE_AUTH_SALT', 'LOGGED_IN_SALT', 'NONCE_SALT'
  ];
  
  saltNames.forEach(name => {
    salts[name] = crypto.randomBytes(64).toString('base64');
  });
  
  return salts;
}

// In Helm values
database:
  password: {{ .Values.secrets.dbPassword | default (randAlphaNum 32) | quote }}
  rootPassword: {{ .Values.secrets.dbRootPassword | default (randAlphaNum 32) | quote }}
```

### Sealed Secrets (Production)

For production, use Sealed Secrets or External Secrets:

```yaml
# Sealed Secret (encrypted, safe to commit)
apiVersion: bitnami.com/v1alpha1
kind: SealedSecret
metadata:
  name: store-platform-secrets
  namespace: store-platform
spec:
  encryptedData:
    db-password: AgByA0...encrypted-data...
    api-key: AgByA0...encrypted-data...
---
# External Secret (fetched from cloud provider)
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: store-credentials
  namespace: store-platform
spec:
  refreshInterval: 1h
  secretStoreRef:
    kind: ClusterSecretStore
    name: aws-secrets-manager
  target:
    name: store-credentials
  data:
    - secretKey: db-password
      remoteRef:
        key: store-platform/db
        property: password
```

### Secret Rotation

#### Automatic Rotation (Certificates)

```yaml
# cert-manager Certificate with auto-renewal
apiVersion: cert-manager.io/v1
kind: Certificate
metadata:
  name: store-tls
  namespace: store-abc123
spec:
  secretName: store-abc123-tls
  issuerRef:
    name: letsencrypt-prod
    kind: ClusterIssuer
  dnsNames:
    - store-abc123.127.0.0.1.nip.io
  # Auto-renew 30 days before expiry
  renewBefore: 720h
```

#### Manual Rotation (Database Credentials)

```bash
#!/bin/bash
# rotate-db-password.sh

STORE_ID=$1
NAMESPACE=store-$STORE_ID

# Generate new password
NEW_PASSWORD=$(openssl rand -base64 32)

# Update secret
kubectl patch secret $STORE_ID-db-credentials -n $NAMESPACE \
  --type='json' \
  -p='[{"op": "replace", "path": "/data/password", "value":"'$(echo -n $NEW_PASSWORD | base64)'"}]'

# Rolling restart to pick up new password
kubectl rollout restart deployment/$STORE_ID-app -n $NAMESPACE
kubectl rollout restart statefulset/$STORE_ID-db -n $NAMESPACE

echo "Password rotated for store $STORE_ID"
```

## RBAC Model

### Service Account Hierarchy

```
Cluster
├── Platform ServiceAccount (provisioner)
│   └── ClusterRole: provisioner-role
│       └── All store namespaces
│
└── Per-Store ServiceAccount
    └── Role: store-role
        └── Single store namespace
```

### Platform Provisioner RBAC

```yaml
# Service Account
apiVersion: v1
kind: ServiceAccount
metadata:
  name: provisioner
  namespace: store-platform
automountServiceAccountToken: true
---
# ClusterRole for provisioner
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: provisioner-role
rules:
  # Namespace management
  - apiGroups: [""]
    resources: ["namespaces"]
    verbs: ["get", "list", "create", "delete", "watch"]
  
  # Core resources
  - apiGroups: [""]
    resources: ["pods", "services", "configmaps", "persistentvolumeclaims", "serviceaccounts"]
    verbs: ["*"]
  
  - apiGroups: [""]
    resources: ["secrets"]
    verbs: ["*"]
  
  # Workloads
  - apiGroups: ["apps"]
    resources: ["deployments", "statefulsets", "replicasets"]
    verbs: ["*"]
  
  # Networking
  - apiGroups: ["networking.k8s.io"]
    resources: ["ingresses", "networkpolicies"]
    verbs: ["*"]
  
  # Batch
  - apiGroups: ["batch"]
    resources: ["jobs", "cronjobs"]
    verbs: ["*"]
  
  # RBAC for creating store roles
  - apiGroups: ["rbac.authorization.k8s.io"]
    resources: ["roles", "rolebindings"]
    verbs: ["*"]
  
  # Events for monitoring
  - apiGroups: [""]
    resources: ["events"]
    verbs: ["get", "list", "watch"]
---
# ClusterRoleBinding
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: provisioner-binding
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: provisioner-role
subjects:
  - kind: ServiceAccount
    name: provisioner
    namespace: store-platform
```

### Store-Specific RBAC

```yaml
# Per-store service account
apiVersion: v1
kind: ServiceAccount
metadata:
  name: store-sa
  namespace: store-abc123
automountServiceAccountToken: false  # Disable if not needed
---
# Per-store role (minimal permissions)
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: store-role
  namespace: store-abc123
rules:
  - apiGroups: [""]
    resources: ["pods"]
    verbs: ["get", "list"]
  
  - apiGroups: [""]
    resources: ["services"]
    verbs: ["get"]
  
  - apiGroups: [""]
    resources: ["configmaps"]
    verbs: ["get"]
    resourceNames: ["store-config"]
---
# RoleBinding
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: store-binding
  namespace: store-abc123
subjects:
  - kind: ServiceAccount
    name: provisioner
    namespace: store-platform
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: Role
  name: store-role
```

### User RBAC (Future)

```yaml
# Regular user
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: store-user
rules:
  - apiGroups: ["platform.io"]
    resources: ["stores"]
    verbs: ["get", "list", "create", "delete"]
    resourceNames: ["store-owned-by-user-*"]
---
# Admin user
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: store-admin
rules:
  - apiGroups: ["platform.io"]
    resources: ["stores"]
    verbs: ["*"]
```

## Namespace Isolation Security

### Network Policies

```yaml
# Deny all ingress by default
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny-ingress
  namespace: store-abc123
spec:
  podSelector: {}
  policyTypes:
    - Ingress
---
# Allow ingress from ingress controller only
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-ingress
  namespace: store-abc123
spec:
  podSelector:
    matchLabels:
      app: store-abc123-app
  policyTypes:
    - Ingress
  ingress:
    - from:
        - namespaceSelector:
            matchLabels:
              name: ingress-nginx
      ports:
        - protocol: TCP
          port: 80
---
# Allow egress to DNS and required services only
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: restricted-egress
  namespace: store-abc123
spec:
  podSelector: {}
  policyTypes:
    - Egress
  egress:
    # Allow DNS
    - to: []
      ports:
        - protocol: UDP
          port: 53
    # Allow within namespace
    - to:
        - podSelector: {}
    # Allow to provisioner for health checks
    - to:
        - namespaceSelector:
            matchLabels:
              name: store-platform
```

### Resource Quotas

```yaml
apiVersion: v1
kind: ResourceQuota
metadata:
  name: store-quota
  namespace: store-abc123
spec:
  hard:
    requests.cpu: "2"
    requests.memory: 4Gi
    limits.cpu: "4"
    limits.memory: 8Gi
    persistentvolumeclaims: "2"
    services.loadbalancers: "0"
    services.nodeports: "0"
    pods: "10"
    replicationcontrollers: "0"
    resourcequotas: "1"
```

### Limit Ranges

```yaml
apiVersion: v1
kind: LimitRange
metadata:
  name: store-limits
  namespace: store-abc123
spec:
  limits:
    - default:
        cpu: 500m
        memory: 512Mi
      defaultRequest:
        cpu: 100m
        memory: 128Mi
      max:
        cpu: 2000m
        memory: 2Gi
      min:
        cpu: 50m
        memory: 64Mi
      type: Container
    - max:
        storage: 50Gi
      min:
        storage: 1Gi
      type: PersistentVolumeClaim
```

## Container Security

### Security Contexts

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: store-app
spec:
  template:
    spec:
      securityContext:
        runAsNonRoot: true
        runAsUser: 1000
        runAsGroup: 1000
        fsGroup: 1000
        seccompProfile:
          type: RuntimeDefault
      containers:
        - name: wordpress
          image: wordpress:6.4-php8.2-apache
          securityContext:
            allowPrivilegeEscalation: false
            readOnlyRootFilesystem: false  # WordPress needs write access
            capabilities:
              drop:
                - ALL
          resources:
            limits:
              cpu: 500m
              memory: 512Mi
            requests:
              cpu: 100m
              memory: 128Mi
```

### Pod Security Standards

```yaml
# Enforce restricted Pod Security Standard
apiVersion: v1
kind: Namespace
metadata:
  name: store-abc123
  labels:
    pod-security.kubernetes.io/enforce: restricted
    pod-security.kubernetes.io/enforce-version: latest
    pod-security.kubernetes.io/audit: restricted
    pod-security.kubernetes.io/warn: restricted
```

## TLS and Encryption

### Certificate Management

```yaml
# Local development - self-signed
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: selfsigned
spec:
  selfSigned: {}
---
# Production - Let's Encrypt
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: admin@example.com
    privateKeySecretRef:
      name: letsencrypt-prod
    solvers:
      - http01:
          ingress:
            class: nginx
```

### Ingress TLS Configuration

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: store-ingress
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    nginx.ingress.kubernetes.io/force-ssl-redirect: "true"
    nginx.ingress.kubernetes.io/proxy-body-size: "100m"
    # Security headers
    nginx.ingress.kubernetes.io/configuration-snippet: |
      add_header X-Frame-Options "SAMEORIGIN" always;
      add_header X-Content-Type-Options "nosniff" always;
      add_header X-XSS-Protection "1; mode=block" always;
      add_header Referrer-Policy "strict-origin-when-cross-origin" always;
spec:
  ingressClassName: nginx
  tls:
    - hosts:
        - store-abc123.stores.example.com
      secretName: store-abc123-tls
  rules:
    - host: store-abc123.stores.example.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: store-app
                port:
                  number: 80
```

### Database Encryption

```yaml
# MySQL SSL configuration
apiVersion: v1
kind: ConfigMap
metadata:
  name: mysql-config
data:
  my.cnf: |
    [mysqld]
    require_secure_transport = ON
    ssl-ca=/etc/mysql/ssl/ca.crt
    ssl-cert=/etc/mysql/ssl/server.crt
    ssl-key=/etc/mysql/ssl/server.key
---
# Mount TLS certificates
volumeMounts:
  - name: mysql-ssl
    mountPath: /etc/mysql/ssl
    readOnly: true
volumes:
  - name: mysql-ssl
    secret:
      secretName: mysql-tls
```

## Secret Rotation Strategy

### Rotation Schedule

| Secret Type | Rotation Frequency | Trigger | Method |
|-------------|-------------------|---------|---------|
| TLS Certificates | 90 days | Expiration | Automatic (cert-manager) |
| Database Passwords | 90 days | Schedule | Manual script |
| API Keys | 180 days | Schedule | Manual/API call |
| Admin Passwords | User request | Event | User-initiated |
| Application Salts | On recreation | Event | Automatic |

### Rotation Procedure

```bash
#!/bin/bash
# rotate-secrets.sh

STORE_ID=$1
SECRET_TYPE=$2

case $SECRET_TYPE in
  db-password)
    # Generate new password
    NEW_PASS=$(openssl rand -base64 32)
    
    # Update secret
    kubectl create secret generic $STORE_ID-db-credentials \
      --from-literal=password=$NEW_PASS \
      --dry-run=client -o yaml | kubectl apply -f -
    
    # Rolling restart
    kubectl rollout restart deployment/$STORE_ID-app -n store-$STORE_ID
    kubectl rollout restart statefulset/$STORE_ID-db -n store-$STORE_ID
    ;;
    
  tls-cert)
    # Trigger cert-manager renewal
    kubectl annotate certificate $STORE_ID-tls -n store-$STORE_ID \
      cert-manager.io/issue-temporary-certificate="true"
    kubectl delete secret $STORE_ID-tls -n store-$STORE_ID
    ;;
    
  *)
    echo "Unknown secret type: $SECRET_TYPE"
    exit 1
    ;;
esac

echo "Secret rotation completed for $STORE_ID"
```

## Production Hardening Checklist

### Pre-Deployment Checklist

- [ ] All secrets stored in Kubernetes Secrets or external vault
- [ ] No hardcoded credentials in code or config
- [ ] RBAC configured with least privilege
- [ ] Network policies enabled for all namespaces
- [ ] Resource quotas and limits set
- [ ] Pod Security Standards enforced
- [ ] TLS enabled for all external endpoints
- [ ] Container images scanned for vulnerabilities
- [ ] Security contexts defined for all containers
- [ ] Audit logging enabled
- [ ] Backup strategy implemented
- [ ] Incident response plan documented

### Infrastructure Security

- [ ] Kubernetes cluster hardened (CIS benchmark)
- [ ] Node OS security updates automated
- [ ] Network segmentation implemented
- [ ] Firewall rules configured
- [ ] DDoS protection enabled
- [ ] Intrusion detection system deployed
- [ ] Log aggregation and monitoring active

### Application Security

- [ ] Input validation on all endpoints
- [ ] SQL injection prevention
- [ ] XSS protection headers
- [ ] CSRF tokens implemented
- [ ] Rate limiting configured
- [ ] Authentication and authorization enforced
- [ ] Session management secure
- [ ] Secure dependencies (no known vulnerabilities)

### Data Security

- [ ] Encryption at rest (volumes)
- [ ] Encryption in transit (TLS 1.3)
- [ ] Database encryption enabled
- [ ] Backup encryption
- [ ] Data retention policies defined
- [ ] PII handling compliant with regulations

## Audit and Compliance

### Audit Logging

```yaml
# Kubernetes audit policy
apiVersion: audit.k8s.io/v1
kind: Policy
rules:
  # Log secret access
  - level: RequestResponse
    resources:
      - group: ""
        resources: ["secrets"]
  
  # Log namespace creation/deletion
  - level: RequestResponse
    resources:
      - group: ""
        resources: ["namespaces"]
    verbs: ["create", "delete"]
  
  # Log RBAC changes
  - level: RequestResponse
    resources:
      - group: "rbac.authorization.k8s.io"
        resources: ["roles", "rolebindings", "clusterroles", "clusterrolebindings"]
  
  # Log everything else at metadata level
  - level: Metadata
```

### Security Scanning

```yaml
# Trivy vulnerability scan
- name: Scan image
  uses: aquasecurity/trivy-action@master
  with:
    image-ref: 'store-platform/dashboard:latest'
    format: 'sarif'
    output: 'trivy-results.sarif'
    severity: 'CRITICAL,HIGH'
    exit-code: '1'

# Kubesec security check
- name: Run kubesec
  run: |
    kubesec scan helm-charts/store-platform/templates/*.yaml
```

## Incident Response

### Security Incident Types

| Severity | Examples | Response Time |
|----------|----------|---------------|
| Critical | Data breach, unauthorized admin access | 15 minutes |
| High | Secret exposure, vulnerability exploit | 1 hour |
| Medium | Suspicious activity, policy violation | 4 hours |
| Low | Misconfiguration, weak passwords | 24 hours |

### Incident Response Procedure

```bash
#!/bin/bash
# incident-response.sh

INCIDENT_TYPE=$1
STORE_ID=$2

echo "Initiating incident response for $INCIDENT_TYPE"

case $INCIDENT_TYPE in
  secret-exposed)
    # Immediate rotation
    ./rotate-secrets.sh $STORE_ID db-password
    ./rotate-secrets.sh $STORE_ID tls-cert
    
    # Audit access
    kubectl logs -n store-$STORE_ID --all-containers --since=24h > /incidents/$STORE_ID-audit.log
    
    # Notify
    echo "Secrets rotated for store $STORE_ID due to exposure" | slack-notify #security
    ;;
    
  unauthorized-access)
    # Isolate store
    kubectl label namespace store-$STORE_ID security/incident=true
    kubectl apply -f - <<EOF
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: incident-isolation
  namespace: store-$STORE_ID
spec:
  podSelector: {}
  policyTypes:
    - Ingress
        - Egress
EOF
    
    # Capture forensics
    kubectl get all -n store-$STORE_ID -o yaml > /incidents/$STORE_ID-forensics.yaml
    ;;
    
  *)
    echo "Unknown incident type"
    exit 1
    ;;
esac
```

## Security Resources

### Tools

- **Trivy:** Container vulnerability scanning
- **Kubesec:** Kubernetes security risk analysis
- **Kube-bench:** CIS Kubernetes benchmark
- **Falco:** Runtime security monitoring
- **OPA/Gatekeeper:** Policy enforcement

### References

- [CIS Kubernetes Benchmark](https://www.cisecurity.org/benchmark/kubernetes)
- [NIST Cybersecurity Framework](https://www.nist.gov/cyberframework)
- [OWASP Kubernetes Security](https://owasp.org/www-project-kubernetes-security/)
- [Kubernetes Security Best Practices](https://kubernetes.io/docs/concepts/security/)

## Document Control

**Version:** 1.0  
**Classification:** Internal  
**Last Updated:** 2024-01-15  
**Next Review:** 2024-04-15  
**Owner:** Security Team  
**Approved By:** CISO

**Change History:**
- 2024-01-15: Initial security documentation
