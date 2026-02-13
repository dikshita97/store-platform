# Technical Requirements

## System Overview and Goals

The Store Provisioning Platform is a Kubernetes-native system that enables automated deployment and lifecycle management of e-commerce stores. The platform supports multiple store engines (WooCommerce, MedusaJS) with full isolation between stores.

**Primary Goals:**
- Enable self-service store provisioning through a web dashboard
- Maintain strict namespace-per-store isolation
- Support concurrent store operations
- Ensure clean resource teardown on deletion
- Provide identical deployment experience across local and production environments

## Functional Requirements

### Dashboard Requirements
- React-based single-page application
- Real-time store status display
- Store creation wizard with engine selection
- Store list with filtering and search
- Individual store management controls
- Activity log and provisioning history

### Provisioning Requirements
- Support for WooCommerce (Round 1: Full Implementation)
- Support for MedusaJS (Round 1: Stubbed, architecture ready)
- Concurrent provisioning of multiple stores
- Progress tracking and status updates
- Rollback on failure
- Resource validation before provisioning

### Lifecycle Management
- Store creation with configurable parameters
- Store health monitoring
- Store updates (scaling, configuration changes)
- Graceful store deletion with resource cleanup
- Backup and restore capabilities

### Deletion Requirements
- Complete namespace removal
- PVC cleanup (configurable retention)
- Ingress rule cleanup
- DNS record cleanup (production)
- Confirmation dialogs and safety checks

## Non-Functional Requirements

### Scalability
- Support 50+ concurrent stores per cluster
- Horizontal scaling of dashboard and API
- Efficient resource utilization
- Connection pooling for databases

### Isolation
- Namespace-per-store architecture
- Network policies between stores
- Resource quotas per namespace
- Separate database instances per store

### Concurrency
- Parallel store provisioning
- Non-blocking operations
- Optimistic locking for store operations
- Queue-based processing for heavy operations

### Security
- No hardcoded secrets
- RBAC for all operations
- Secret rotation support
- TLS termination at ingress
- Network isolation between stores

## Kubernetes Requirements

### Namespaces
```yaml
# System namespaces
store-platform        # Core platform components
cert-manager          # TLS certificate management
ingress-nginx         # Ingress controller (if not already present)

# Per-store namespaces (dynamically created)
store-{store-id}      # Individual store isolation
```

### Deployments
- **Dashboard**: React app served via nginx
- **API/Provisioner**: Node.js/Python backend
- **Store Engines**: WordPress (WooCommerce) or Medusa containers

### StatefulSets
- **Database**: MySQL/PostgreSQL per store
- Ensures ordered deployment and stable network identity

### Services
```yaml
# Per-store services
{store-name}-db       # Database service (ClusterIP)
{store-name}-app      # Application service (ClusterIP)
```

### Ingress
```yaml
# Local development
store-{id}.127.0.0.1.nip.io

# Production
{store-name}.{base-domain}.com
```

### PVCs
```yaml
# Database storage
data-{store-name}-db-0    # 10Gi default
# Media/uploads (WooCommerce)
{store-name}-uploads      # 5Gi default
```

### Secrets
- Database credentials (auto-generated)
- WordPress salts (WooCommerce)
- API keys and tokens
- TLS certificates (managed by cert-manager)

### Jobs
- Database initialization jobs
- Migration jobs
- Cleanup jobs for deletion

## Helm Requirements

### Chart Structure
```
helm-charts/
├── store-platform/          # Main platform chart
│   ├── charts/
│   │   ├── dashboard/       # React dashboard subchart
│   │   ├── provisioner/     # Backend API subchart
│   │   └── store-engine/    # Reusable store template
│   ├── templates/
│   └── values.yaml
└── store-instance/          # Dynamic store deployment chart
    ├── templates/
    └── values.yaml
```

### Required Values

**Global Values (values.yaml)**
```yaml
global:
  environment: local  # local | production
  baseDomain: 127.0.0.1.nip.io
  storageClass: standard
  
dashboard:
  replicas: 1
  image: store-platform/dashboard:latest
  
provisioner:
  replicas: 2
  image: store-platform/provisioner:latest
  
store:
  defaultResources:
    requests:
      memory: 512Mi
      cpu: 250m
    limits:
      memory: 1Gi
      cpu: 500m
```

**values-local.yaml**
```yaml
global:
  environment: local
  baseDomain: 127.0.0.1.nip.io
  storageClass: standard

ingress:
  class: nginx
  annotations:
    cert-manager.io/cluster-issuer: "selfsigned"
    
store:
  persistence:
    size: 5Gi
```

**values-prod.yaml**
```yaml
global:
  environment: production
  baseDomain: stores.example.com
  storageClass: fast-ssd

ingress:
  class: nginx
  annotations:
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
    
store:
  persistence:
    size: 50Gi
  resources:
    requests:
      memory: 1Gi
      cpu: 500m
```

## Environment Compatibility

### Local Development (Kind/k3d/Minikube)
- Single-node cluster acceptable
- nip.io for DNS resolution
- Local storage class
- Self-signed certificates
- Lower resource limits

### Production (k3s VPS)
- Multi-node recommended
- Real DNS records
- SSD-backed storage
- Let's Encrypt certificates
- Higher resource limits
- Monitoring stack

### Environment Detection
Helm charts use `.Values.global.environment` to conditionally render:
- Ingress host patterns
- Certificate issuers
- Resource limits
- Storage classes
- Replicas count

## Health Checks

### Readiness Probes
```yaml
readinessProbe:
  httpGet:
    path: /health/ready
    port: 8080
  initialDelaySeconds: 10
  periodSeconds: 5
  failureThreshold: 3
```

### Liveness Probes
```yaml
livenessProbe:
  httpGet:
    path: /health/live
    port: 8080
  initialDelaySeconds: 30
  periodSeconds: 10
  failureThreshold: 3
```

### Startup Probes (for slow-starting apps)
```yaml
startupProbe:
  httpGet:
    path: /health/startup
    port: 8080
  initialDelaySeconds: 10
  periodSeconds: 5
  failureThreshold: 30
```

## Persistent Storage Strategy

### Database Storage
- Type: PersistentVolumeClaim
- AccessMode: ReadWriteOnce
- ReclaimPolicy: Retain (configurable)
- Backup: Scheduled snapshots

### Media Storage (WooCommerce)
- Type: PersistentVolumeClaim
- AccessMode: ReadWriteOnce
- Optional: S3-compatible object storage for production scaling

### Storage Classes
```yaml
# Local
type: standard
reclaimPolicy: Delete

# Production
type: fast-ssd
reclaimPolicy: Retain
```

## Secrets Handling

### Strategy
1. **Kubernetes Secrets**: Runtime secrets (DB passwords, API keys)
2. **Sealed Secrets/External Secrets**: Git-committed encrypted secrets
3. **Cert-Manager**: TLS certificates
4. **No hardcoded values**: All secrets templated via Helm

### Secret Generation
```yaml
# Auto-generated if not provided
secrets:
  dbPassword:
    autoGenerate: true
    length: 32
  wordpressSalt:
    autoGenerate: true
```

### Secret Rotation
- Support for rolling updates
- Versioned secrets
- Graceful credential rotation

## Clean Teardown Behavior

### On Store Deletion
1. Scale deployments to 0
2. Backup data (optional)
3. Delete Helm release
4. Delete namespace
5. Verify PVC deletion
6. Clean up ingress rules

### Retention Policies
```yaml
deletionPolicy:
  retainData: false  # Set to true for soft delete
  backupBeforeDelete: true
  retentionDays: 7   # For soft-deleted stores
```

## Acceptance Criteria

### Definition of Done - WooCommerce
1. **Dashboard Access**
   - [ ] Dashboard loads at https://dashboard.127.0.0.1.nip.io
   - [ ] Login/authentication works
   - [ ] Store list displays correctly

2. **Store Creation**
   - [ ] Create store form accepts all required fields
   - [ ] Store provisions within 5 minutes
   - [ ] Store appears in list with "Running" status
   - [ ] Store URL is accessible

3. **End-to-End Order Flow**
   - [ ] Storefront loads at https://{store-name}.127.0.0.1.nip.io
   - [ ] Product can be added to cart
   - [ ] Checkout completes with COD payment
   - [ ] Order appears in WooCommerce admin
   - [ ] Order can be marked complete

4. **Deletion**
   - [ ] Delete button prompts for confirmation
   - [ ] Store removes from list within 2 minutes
   - [ ] Namespace and all resources deleted
   - [ ] Ingress rules removed

### Definition of Done - Medusa (Round 1: Architecture)
1. **Architecture Support**
   - [ ] Helm templates support Medusa engine selection
   - [ ] Database schema ready for Medusa
   - [ ] Ingress pattern supports Medusa routes

2. **Stub Implementation**
   - [ ] Medusa option visible in creation form
   - [ ] Selection triggers "Coming Soon" message
   - [ ] No broken references or missing templates

## Assumptions & Constraints

### Assumptions
- Kubernetes cluster version 1.24+
- Helm 3.x installed
- Ingress controller (nginx) available
- cert-manager available for TLS
- Sufficient node resources (8GB RAM minimum for local)
- DNS resolution available (nip.io or real DNS)

### Constraints
- Single cluster deployment (no multi-cluster federation)
- No custom CRDs required
- No operators (pure Helm/Kubernetes resources)
- No persistent volumes across cluster rebuilds
- WooCommerce requires MySQL 8.0+
- Medusa requires PostgreSQL 14+

### Known Limitations
- Store migration between clusters not supported in Round 1
- No automated horizontal scaling of stores
- No CDN integration in Round 1
- No automated backup scheduling (manual triggers only)

## Example Commands

### Install Platform
```bash
# Local
helm install store-platform ./helm-charts/store-platform \
  -f ./helm-charts/store-platform/values.yaml \
  -f ./helm-charts/store-platform/values-local.yaml \
  -n store-platform --create-namespace

# Production
helm install store-platform ./helm-charts/store-platform \
  -f ./helm-charts/store-platform/values.yaml \
  -f ./helm-charts/store-platform/values-prod.yaml \
  -n store-platform --create-namespace
```

### Provision a Store
```bash
# Via API (dashboard will call this)
curl -X POST http://provisioner.store-platform.svc.cluster.local/api/v1/stores \
  -H "Content-Type: application/json" \
  -d '{
    "name": "my-store",
    "engine": "woocommerce",
    "plan": "basic"
  }'

# Direct Helm (for testing)
helm install store-my-store ./helm-charts/store-instance \
  --set store.name=my-store \
  --set store.engine=woocommerce \
  --set ingress.host=my-store.127.0.0.1.nip.io \
  -n store-my-store --create-namespace
```

### Delete a Store
```bash
# Via API
curl -X DELETE http://provisioner.store-platform.svc.cluster.local/api/v1/stores/my-store

# Direct Helm
helm uninstall store-my-store -n store-my-store
kubectl delete namespace store-my-store
```

### Check Status
```bash
# List all stores
kubectl get namespaces -l app.kubernetes.io/part-of=store-platform

# Check store status
kubectl get all -n store-my-store

# View logs
kubectl logs -n store-my-store deployment/my-store-app
```

## References

- [Helm Best Practices](https://helm.sh/docs/chart_best_practices/)
- [Kubernetes Documentation](https://kubernetes.io/docs/)
- [Cert-Manager Documentation](https://cert-manager.io/docs/)
- [NGINX Ingress Controller](https://kubernetes.github.io/ingress-nginx/)
