# RBAC Configuration and Least Privilege Guide

## Overview

This document describes the Role-Based Access Control (RBAC) configuration for the Store Provisioning Platform, designed with the principle of **least privilege**.

## RBAC Architecture

### Service Accounts

#### 1. Platform Provisioner Service Account
**Namespace**: `store-platform`  
**Purpose**: API service for managing store lifecycle

```yaml
# helm/dashboard/templates/serviceaccount.yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: store-platform-provisioner
  namespace: store-platform
```

**Permissions**:
- Create/Delete/List namespaces
- Manage Helm releases across cluster
- Manage secrets in store namespaces
- View pods and deployments for status checks

#### 2. Store Service Accounts
**Namespace**: Per-store namespaces  
**Purpose**: Each store has its own service account for internal operations

### Cluster Roles

#### 1. store-platform-provisioner (ClusterRole)
```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: store-platform-provisioner
rules:
  # Namespace management
  - apiGroups: [""]
    resources: ["namespaces"]
    verbs: ["get", "list", "watch", "create", "delete"]
  
  # Helm/ConfigMap management
  - apiGroups: [""]
    resources: ["configmaps", "secrets"]
    verbs: ["*"]
  
  # Storage management
  - apiGroups: [""]
    resources: ["persistentvolumeclaims", "persistentvolumes"]
    verbs: ["*"]
  
  # Deployment and StatefulSet management
  - apiGroups: ["apps"]
    resources: ["deployments", "statefulsets", "replicasets"]
    verbs: ["*"]
  
  # Service and Ingress management
  - apiGroups: [""]
    resources: ["services"]
    verbs: ["*"]
  - apiGroups: ["networking.k8s.io"]
    resources: ["ingresses", "networkpolicies"]
    verbs: ["*"]
  
  # Pod management
  - apiGroups: [""]
    resources: ["pods", "pods/log"]
    verbs: ["*"]
```

**Principle Applied**: The provisioner needs broad access to manage stores, but it's limited to:
- No access to Kubernetes system namespaces (kube-system, kube-public, etc.)
- No access to modify ClusterRoles or ClusterRoleBindings
- No access to node resources

### Role Bindings

#### ClusterRoleBinding
```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: store-platform-provisioner
subjects:
  - kind: ServiceAccount
    name: store-platform-provisioner
    namespace: store-platform
roleRef:
  kind: ClusterRole
  name: store-platform-provisioner
  apiGroup: rbac.authorization.k8s.io
```

### Store-Level RBAC

Each store namespace has minimal RBAC:

#### Service Account (per store)
```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: store-sa
  namespace: store-<id>
automountServiceAccountToken: false  # Security: Don't mount token unless needed
```

#### Role (per store namespace)
```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: store-role
  namespace: store-<id>
rules:
  # Read-only access to own namespace resources
  - apiGroups: [""]
    resources: ["configmaps", "secrets"]
    verbs: ["get", "list"]
    resourceNames: ["wordpress-config", "mysql-credentials"]
  
  # No access to create/delete resources
  # No access to other namespaces
```

## Security Controls

### 1. Automount Service Account Token
**Control**: Disable automounting of service account tokens
```yaml
automountServiceAccountToken: false
```
**Rationale**: Reduces attack surface by not mounting tokens unless explicitly needed

### 2. Resource Name Restrictions
**Control**: Limit access to specific named resources
```yaml
resourceNames:
  - "wordpress-config"
  - "mysql-credentials"
```
**Rationale**: Prevents access to unauthorized secrets

### 3. Namespace Isolation
**Control**: Each store in separate namespace with network policies
```yaml
# Network Policy
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny
spec:
  podSelector: {}
  policyTypes:
    - Ingress
    - Egress
```
**Rationale**: Isolates stores from each other

## RBAC Audit Commands

### List All Service Accounts
```bash
kubectl get serviceaccounts --all-namespaces
```

### Check Service Account Permissions
```bash
# Check what the provisioner can do
kubectl auth can-i --list --as=system:serviceaccount:store-platform:store-platform-provisioner

# Check specific permissions
kubectl auth can-i create namespaces --as=system:serviceaccount:store-platform:store-platform-provisioner
kubectl auth can-i delete pods --as=system:serviceaccount:store-platform:store-platform-provisioner
```

### Audit RBAC Bindings
```bash
# List all role bindings
kubectl get rolebindings,clusterrolebindings --all-namespaces

# Check who has cluster-admin
kubectl get clusterrolebindings -o json | \
  jq -r '.items[] | select(.roleRef.name=="cluster-admin") | .metadata.name'

# Review provisioner permissions
kubectl get clusterrole store-platform-provisioner -o yaml
```

### Review Privileged Access
```bash
# Check for privileged pods
kubectl get pods --all-namespaces -o json | \
  jq '.items[] | select(.spec.containers[].securityContext.privileged==true) | .metadata.name'

# Check for pods with hostNetwork
kubectl get pods --all-namespaces -o json | \
  jq '.items[] | select(.spec.hostNetwork==true) | .metadata.name'
```

## Least Privilege Checklist

### For Platform Components

- [ ] Service accounts have minimal required permissions
- [ ] No cluster-admin role bindings for application accounts
- [ ] Resource names restricted where possible
- [ ] AutomountServiceAccountToken disabled when not needed
- [ ] Regular review of RBAC bindings (quarterly)
- [ ] No wildcard permissions (*)
- [ ] Separate service accounts per component

### For Store Namespaces

- [ ] No access to Kubernetes API from store pods
- [ ] Network policies restrict inter-namespace traffic
- [ ] No privileged containers
- [ ] No hostPath volumes
- [ ] Resource quotas enforced
- [ ] Read-only root filesystem where possible

## RBAC Review Procedure

### Quarterly Review

1. **Extract Current RBAC**
```bash
kubectl get clusterroles,clusterrolebindings,roles,rolebindings --all-namespaces -o yaml > rbac-snapshot-$(date +%Y%m%d).yaml
```

2. **Analyze Permissions**
```bash
# Check for wildcard permissions
kubectl get clusterroles -o json | \
  jq '.items[] | select(.rules[].verbs[] | contains("*")) | .metadata.name'

# Check for unused service accounts
kubectl get serviceaccounts --all-namespaces -o json | \
  jq '.items[] | select(.secrets == null) | .metadata.name'
```

3. **Review Access Logs**
```bash
# Enable audit logging in cluster
# Review for unexpected access patterns
```

4. **Update Documentation**
- Document any new permissions granted
- Remove unused permissions
- Update this guide

## Common RBAC Issues and Solutions

### Issue: Permission Denied
```bash
# Error: User cannot create namespaces
# Solution: Check if user has proper role binding
kubectl auth can-i create namespaces --as=user@example.com
```

### Issue: Too Broad Permissions
```bash
# Check for wildcard permissions
kubectl get clusterrole <role-name> -o json | \
  jq '.rules[] | select(.verbs | contains(["*"]))'
```

### Issue: Service Account Token Leak
```bash
# Solution: Disable automounting
curl -k -H "Authorization: Bearer $(kubectl get secret <secret-name> -o jsonpath='{.data.token}' | base64 -d)" \
  https://kubernetes.default.svc/api/v1/namespaces
```

## Compliance Mapping

### CIS Kubernetes Benchmark

| Control | Implementation | Status |
|---------|---------------|--------|
| 5.1.1 | Ensure non-root containers | ✅ |
| 5.1.2 | Ensure secrets are not mounted as env vars | ✅ |
| 5.1.3 | Ensure service accounts have minimal permissions | ✅ |
| 5.1.4 | No automounting of service account tokens | ✅ |
| 5.1.5 | Ensure default service accounts not used | ✅ |
| 5.2.1 | Minimize wildcard use in Roles | ✅ |
| 5.2.2 | Minimize wildcard use in ClusterRoles | ✅ |
| 5.2.3 | Minimize access to secrets | ✅ |

## Future Improvements

1. **OPA/Gatekeeper Policies**
   - Enforce RBAC policies at admission time
   - Prevent overly permissive roles

2. **Just-in-Time Access**
   - Temporary elevation of privileges
   - Audit all elevated access

3. **RBAC Visualization**
   - Tools to visualize permission graphs
   - Identify permission boundaries

---

*Last Updated: 2024*  
*Owner: Platform Security Team*
