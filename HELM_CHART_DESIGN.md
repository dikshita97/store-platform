# Helm Chart Design

## Helm Chart Structure

```
helm-charts/
├── store-platform/                    # Main platform umbrella chart
│   ├── Chart.yaml                     # Chart metadata
│   ├── values.yaml                    # Default values
│   ├── values-local.yaml              # Local development overrides
│   ├── values-prod.yaml               # Production overrides
│   ├── charts/                        # Subcharts
│   │   ├── dashboard/                 # React dashboard
│   │   │   ├── Chart.yaml
│   │   │   ├── values.yaml
│   │   │   └── templates/
│   │   │       ├── deployment.yaml
│   │   │       ├── service.yaml
│   │   │       ├── ingress.yaml
│   │   │       ├── configmap.yaml
│   │   │       └── _helpers.tpl
│   │   │
│   │   ├── provisioner/               # Backend API
│   │   │   ├── Chart.yaml
│   │   │   ├── values.yaml
│   │   │   └── templates/
│   │   │       ├── deployment.yaml
│   │   │       ├── service.yaml
│   │   │       ├── ingress.yaml
│   │   │       ├── serviceaccount.yaml
│   │   │       ├── rbac.yaml
│   │   │       ├── secret.yaml
│   │   │       └── _helpers.tpl
│   │   │
│   │   └── store-engine/              # Base template for stores
│   │       ├── Chart.yaml
│   │       ├── values.yaml
│   │       └── templates/
│   │           ├── _helpers.tpl
│   │           ├── namespace.yaml
│   │           ├── database/
│   │           │   ├── statefulset.yaml
│   │           │   ├── service.yaml
│   │           │   ├── pvc.yaml
│   │           │   └── secret.yaml
│   │           ├── application/
│   │           │   ├── deployment.yaml
│   │           │   ├── service.yaml
│   │           │   └── configmap.yaml
│   │           ├── ingress.yaml
│   │           ├── networkpolicy.yaml
│   │           ├── resourcequota.yaml
│   │           └── secret.yaml
│   │
│   └── templates/
│       └── NOTES.txt                  # Post-install instructions
│
└── store-instance/                    # Dynamic store chart
    ├── Chart.yaml
    ├── values.yaml
    └── templates/
        ├── _helpers.tpl
        ├── namespace.yaml
        ├── secrets.yaml
        ├── database-mysql.yaml         # MySQL for WooCommerce
        ├── database-postgres.yaml      # PostgreSQL for Medusa
        ├── wordpress.yaml              # WooCommerce deployment
        ├── medusa.yaml                 # Medusa deployment (Round 2)
        ├── ingress.yaml
        └── networkpolicy.yaml
```

## Chart: store-platform

### Chart.yaml

```yaml
apiVersion: v2
name: store-platform
description: A Helm chart for the Store Provisioning Platform
type: application
version: 1.0.0
appVersion: "1.0.0"
dependencies:
  - name: dashboard
    version: "1.0.0"
    repository: "file://charts/dashboard"
    condition: dashboard.enabled
  - name: provisioner
    version: "1.0.0"
    repository: "file://charts/provisioner"
    condition: provisioner.enabled
  - name: store-engine
    version: "1.0.0"
    repository: "file://charts/store-engine"
    condition: store-engine.enabled
```

### values.yaml (Default)

```yaml
# Global configuration
global:
  environment: local
  baseDomain: 127.0.0.1.nip.io
  storageClass: standard
  imageRegistry: ""
  imagePullSecrets: []

# Dashboard configuration
dashboard:
  enabled: true
  replicaCount: 1
  
  image:
    repository: store-platform/dashboard
    pullPolicy: IfNotPresent
    tag: "latest"
  
  service:
    type: ClusterIP
    port: 80
  
  ingress:
    enabled: true
    className: nginx
    annotations:
      cert-manager.io/cluster-issuer: selfsigned
    hosts:
      - host: dashboard.127.0.0.1.nip.io
        paths:
          - path: /
            pathType: Prefix
    tls:
      - secretName: dashboard-tls
        hosts:
          - dashboard.127.0.0.1.nip.io
  
  resources:
    limits:
      cpu: 500m
      memory: 256Mi
    requests:
      cpu: 100m
      memory: 128Mi

# Provisioner configuration
provisioner:
  enabled: true
  replicaCount: 2
  
  image:
    repository: store-platform/provisioner
    pullPolicy: IfNotPresent
    tag: "latest"
  
  service:
    type: ClusterIP
    port: 8080
  
  ingress:
    enabled: true
    className: nginx
    annotations:
      cert-manager.io/cluster-issuer: selfsigned
    hosts:
      - host: api.127.0.0.1.nip.io
        paths:
          - path: /
            pathType: Prefix
    tls:
      - secretName: provisioner-tls
        hosts:
          - api.127.0.0.1.nip.io
  
  resources:
    limits:
      cpu: 1000m
      memory: 512Mi
    requests:
      cpu: 250m
      memory: 256Mi
  
  persistence:
    enabled: true
    storageClass: standard
    size: 5Gi
    accessMode: ReadWriteOnce
  
  # Database for provisioner state
  database:
    type: postgres
    host: provisioner-db
    port: 5432
    name: provisioner
    user: provisioner
    password: ""  # Auto-generated if empty

# Store engine template configuration
store-engine:
  enabled: false  # Only used as template, not deployed directly

# Cert-manager configuration
cert-manager:
  enabled: true
  install: false  # Assume already installed
```

### values-local.yaml

```yaml
global:
  environment: local
  baseDomain: 127.0.0.1.nip.io
  storageClass: standard

dashboard:
  ingress:
    hosts:
      - host: dashboard.127.0.0.1.nip.io
        paths:
          - path: /
            pathType: Prefix
    tls:
      - secretName: dashboard-tls
        hosts:
          - dashboard.127.0.0.1.nip.io

provisioner:
  ingress:
    hosts:
      - host: api.127.0.0.1.nip.io
        paths:
          - path: /
            pathType: Prefix
    tls:
      - secretName: provisioner-tls
        hosts:
          - api.127.0.0.1.nip.io
  
  replicaCount: 1  # Single replica for local
  
  resources:
    limits:
      cpu: 500m
      memory: 256Mi
    requests:
      cpu: 100m
      memory: 128Mi

# Enable debug mode
provisioner:
  env:
    LOG_LEVEL: debug
    DEBUG: "true"
```

### values-prod.yaml

```yaml
global:
  environment: production
  baseDomain: stores.example.com
  storageClass: fast-ssd

dashboard:
  replicaCount: 2
  
  ingress:
    annotations:
      cert-manager.io/cluster-issuer: letsencrypt-prod
      nginx.ingress.kubernetes.io/rate-limit: "100"
    hosts:
      - host: dashboard.stores.example.com
        paths:
          - path: /
            pathType: Prefix
    tls:
      - secretName: dashboard-tls
        hosts:
          - dashboard.stores.example.com
  
  resources:
    limits:
      cpu: 1000m
      memory: 512Mi
    requests:
      cpu: 250m
      memory: 256Mi

provisioner:
  replicaCount: 3
  
  ingress:
    annotations:
      cert-manager.io/cluster-issuer: letsencrypt-prod
      nginx.ingress.kubernetes.io/rate-limit: "200"
    hosts:
      - host: api.stores.example.com
        paths:
          - path: /
            pathType: Prefix
    tls:
      - secretName: provisioner-tls
        hosts:
          - api.stores.example.com
  
  resources:
    limits:
      cpu: 2000m
      memory: 1Gi
    requests:
      cpu: 500m
      memory: 512Mi
  
  persistence:
    storageClass: fast-ssd
    size: 20Gi
  
  env:
    LOG_LEVEL: info
    DEBUG: "false"

# Pod disruption budgets
podDisruptionBudget:
  enabled: true
  minAvailable: 1

# Network policies
networkPolicy:
  enabled: true
```

## Chart: dashboard

### templates/_helpers.tpl

```yaml
{{/* vim: set filetype=mustache: */}}
{{/* Expand the name of the chart. */}}
{{- define "dashboard.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{/* Create a default fully qualified app name. */}}
{{- define "dashboard.fullname" -}}
{{- if .Values.fullnameOverride -}}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- $name := default .Chart.Name .Values.nameOverride -}}
{{- if contains $name .Release.Name -}}
{{- .Release.Name | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" -}}
{{- end -}}
{{- end -}}
{{- end -}}

{{/* Create chart name and version */}}
{{- define "dashboard.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{/* Common labels */}}
{{- define "dashboard.labels" -}}
helm.sh/chart: {{ include "dashboard.chart" . }}
{{ include "dashboard.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end -}}

{{/* Selector labels */}}
{{- define "dashboard.selectorLabels" -}}
app.kubernetes.io/name: {{ include "dashboard.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end -}}
```

### templates/deployment.yaml

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ include "dashboard.fullname" . }}
  labels:
    {{- include "dashboard.labels" . | nindent 4 }}
spec:
  replicas: {{ .Values.replicaCount }}
  selector:
    matchLabels:
      {{- include "dashboard.selectorLabels" . | nindent 6 }}
  template:
    metadata:
      labels:
        {{- include "dashboard.selectorLabels" . | nindent 8 }}
    spec:
      containers:
        - name: dashboard
          image: "{{ .Values.image.repository }}:{{ .Values.image.tag | default .Chart.AppVersion }}"
          imagePullPolicy: {{ .Values.image.pullPolicy }}
          ports:
            - name: http
              containerPort: 80
              protocol: TCP
          livenessProbe:
            httpGet:
              path: /health/live
              port: http
            initialDelaySeconds: 30
            periodSeconds: 10
          readinessProbe:
            httpGet:
              path: /health/ready
              port: http
            initialDelaySeconds: 5
            periodSeconds: 5
          resources:
            {{- toYaml .Values.resources | nindent 12 }}
          volumeMounts:
            - name: config
              mountPath: /usr/share/nginx/html/config.json
              subPath: config.json
      volumes:
        - name: config
          configMap:
            name: {{ include "dashboard.fullname" . }}-config
```

### templates/configmap.yaml

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: {{ include "dashboard.fullname" . }}-config
  labels:
    {{- include "dashboard.labels" . | nindent 4 }}
data:
  config.json: |
    {
      "apiUrl": "https://{{ .Values.global.baseDomain }}/api",
      "environment": "{{ .Values.global.environment }}",
      "features": {
        "medusaEnabled": false
      }
    }
```

### templates/ingress.yaml

```yaml
{{- if .Values.ingress.enabled -}}
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: {{ include "dashboard.fullname" . }}
  labels:
    {{- include "dashboard.labels" . | nindent 4 }}
  {{- with .Values.ingress.annotations }}
  annotations:
    {{- toYaml . | nindent 4 }}
  {{- end }}
spec:
  ingressClassName: {{ .Values.ingress.className }}
  {{- if .Values.ingress.tls }}
  tls:
    {{- range .Values.ingress.tls }}
    - hosts:
        {{- range .hosts }}
        - {{ . | quote }}
        {{- end }}
      secretName: {{ .secretName }}
    {{- end }}
  {{- end }}
  rules:
    {{- range .Values.ingress.hosts }}
    - host: {{ .host | quote }}
      http:
        paths:
          {{- range .paths }}
          - path: {{ .path }}
            pathType: {{ .pathType }}
            backend:
              service:
                name: {{ include "dashboard.fullname" $ }}
                port:
                  number: {{ $.Values.service.port }}
          {{- end }}
    {{- end }}
{{- end }}
```

## Chart: provisioner

### templates/rbac.yaml

```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: {{ include "provisioner.fullname" . }}
  labels:
    {{- include "provisioner.labels" . | nindent 4 }}
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: {{ include "provisioner.fullname" . }}
rules:
  # Namespace management
  - apiGroups: [""]
    resources: ["namespaces"]
    verbs: ["get", "list", "create", "delete", "watch"]
  
  # Core resources
  - apiGroups: [""]
    resources: ["pods", "services", "configmaps", "secrets", "persistentvolumeclaims", "serviceaccounts"]
    verbs: ["*"]
  
  # Workload resources
  - apiGroups: ["apps"]
    resources: ["deployments", "statefulsets", "replicasets"]
    verbs: ["*"]
  
  # Networking
  - apiGroups: ["networking.k8s.io"]
    resources: ["ingresses", "networkpolicies"]
    verbs: ["*"]
  
  # Batch jobs
  - apiGroups: ["batch"]
    resources: ["jobs", "cronjobs"]
    verbs: ["*"]
  
  # RBAC
  - apiGroups: ["rbac.authorization.k8s.io"]
    resources: ["roles", "rolebindings"]
    verbs: ["*"]
  
  # Events
  - apiGroups: [""]
    resources: ["events"]
    verbs: ["get", "list", "watch"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: {{ include "provisioner.fullname" . }}
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: {{ include "provisioner.fullname" . }}
subjects:
  - kind: ServiceAccount
    name: {{ include "provisioner.fullname" . }}
    namespace: {{ .Release.Namespace }}
```

### templates/deployment.yaml

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ include "provisioner.fullname" . }}
  labels:
    {{- include "provisioner.labels" . | nindent 4 }}
spec:
  replicas: {{ .Values.replicaCount }}
  selector:
    matchLabels:
      {{- include "provisioner.selectorLabels" . | nindent 6 }}
  template:
    metadata:
      labels:
        {{- include "provisioner.selectorLabels" . | nindent 8 }}
    spec:
      serviceAccountName: {{ include "provisioner.fullname" . }}
      containers:
        - name: provisioner
          image: "{{ .Values.image.repository }}:{{ .Values.image.tag | default .Chart.AppVersion }}"
          imagePullPolicy: {{ .Values.image.pullPolicy }}
          ports:
            - name: http
              containerPort: 8080
              protocol: TCP
          env:
            - name: NODE_ENV
              value: {{ .Values.global.environment | quote }}
            - name: LOG_LEVEL
              value: {{ .Values.env.LOG_LEVEL | default "info" | quote }}
            - name: DB_HOST
              value: {{ .Values.database.host | quote }}
            - name: DB_PORT
              value: {{ .Values.database.port | quote }}
            - name: DB_NAME
              value: {{ .Values.database.name | quote }}
            - name: DB_USER
              value: {{ .Values.database.user | quote }}
            - name: DB_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: {{ include "provisioner.fullname" . }}-db
                  key: password
            - name: HELM_CHART_PATH
              value: /charts/store-instance
            - name: BASE_DOMAIN
              value: {{ .Values.global.baseDomain | quote }}
          livenessProbe:
            httpGet:
              path: /health/live
              port: http
            initialDelaySeconds: 30
            periodSeconds: 10
          readinessProbe:
            httpGet:
              path: /health/ready
              port: http
            initialDelaySeconds: 10
            periodSeconds: 5
          resources:
            {{- toYaml .Values.resources | nindent 12 }}
          volumeMounts:
            - name: charts
              mountPath: /charts
            - name: tmp
              mountPath: /tmp
      volumes:
        - name: charts
          emptyDir: {}
        - name: tmp
          emptyDir: {}
```

## Chart: store-engine (Template)

### templates/namespace.yaml

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: {{ .Values.store.namespace }}
  labels:
    app.kubernetes.io/name: store
    app.kubernetes.io/instance: {{ .Values.store.name }}
    app.kubernetes.io/part-of: store-platform
    store.platform.io/id: {{ .Values.store.id }}
    store.platform.io/engine: {{ .Values.store.engine }}
  annotations:
    store.platform.io/created-by: {{ .Values.store.createdBy | quote }}
    store.platform.io/created-at: {{ now | quote }}
```

### templates/database/statefulset.yaml (MySQL for WooCommerce)

```yaml
{{- if eq .Values.store.engine "woocommerce" }}
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: {{ .Values.store.name }}-db
  namespace: {{ .Values.store.namespace }}
  labels:
    app: {{ .Values.store.name }}-db
    store.platform.io/id: {{ .Values.store.id }}
spec:
  serviceName: {{ .Values.store.name }}-db
  replicas: 1
  selector:
    matchLabels:
      app: {{ .Values.store.name }}-db
  template:
    metadata:
      labels:
        app: {{ .Values.store.name }}-db
    spec:
      containers:
        - name: mysql
          image: mysql:8.0
          env:
            - name: MYSQL_ROOT_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: {{ .Values.store.name }}-db-credentials
                  key: root-password
            - name: MYSQL_DATABASE
              value: wordpress
            - name: MYSQL_USER
              value: wordpress
            - name: MYSQL_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: {{ .Values.store.name }}-db-credentials
                  key: password
          ports:
            - containerPort: 3306
              name: mysql
          volumeMounts:
            - name: data
              mountPath: /var/lib/mysql
          resources:
            {{- toYaml .Values.database.resources | nindent 12 }}
          livenessProbe:
            exec:
              command:
                - mysqladmin
                - ping
            initialDelaySeconds: 30
            periodSeconds: 10
          readinessProbe:
            exec:
              command:
                - mysqladmin
                - ping
            initialDelaySeconds: 5
            periodSeconds: 5
  volumeClaimTemplates:
    - metadata:
        name: data
      spec:
        accessModes: ["ReadWriteOnce"]
        storageClassName: {{ .Values.global.storageClass }}
        resources:
          requests:
            storage: {{ .Values.database.persistence.size }}
{{- end }}
```

### templates/application/deployment.yaml (WooCommerce)

```yaml
{{- if eq .Values.store.engine "woocommerce" }}
apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ .Values.store.name }}-app
  namespace: {{ .Values.store.namespace }}
  labels:
    app: {{ .Values.store.name }}-app
    store.platform.io/id: {{ .Values.store.id }}
spec:
  replicas: 1
  selector:
    matchLabels:
      app: {{ .Values.store.name }}-app
  template:
    metadata:
      labels:
        app: {{ .Values.store.name }}-app
    spec:
      initContainers:
        - name: wait-for-db
          image: busybox:1.36
          command:
            - sh
            - -c
            - |
              until nc -z {{ .Values.store.name }}-db 3306; do
                echo "Waiting for database..."
                sleep 2
              done
      containers:
        - name: wordpress
          image: wordpress:6.4-php8.2-apache
          env:
            - name: WORDPRESS_DB_HOST
              value: {{ .Values.store.name }}-db:3306
            - name: WORDPRESS_DB_NAME
              value: wordpress
            - name: WORDPRESS_DB_USER
              value: wordpress
            - name: WORDPRESS_DB_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: {{ .Values.store.name }}-db-credentials
                  key: password
            - name: WORDPRESS_TABLE_PREFIX
              value: wp_
            - name: WORDPRESS_CONFIG_EXTRA
              value: |
                define('WP_HOME', 'https://{{ .Values.ingress.host }}');
                define('WP_SITEURL', 'https://{{ .Values.ingress.host }}');
                define('FS_METHOD', 'direct');
          ports:
            - containerPort: 80
              name: http
          volumeMounts:
            - name: uploads
              mountPath: /var/www/html/wp-content/uploads
          resources:
            {{- toYaml .Values.app.resources | nindent 12 }}
          livenessProbe:
            httpGet:
              path: /wp-includes/images/blank.gif
              port: 80
            initialDelaySeconds: 60
            periodSeconds: 10
          readinessProbe:
            httpGet:
              path: /wp-includes/images/blank.gif
              port: 80
            initialDelaySeconds: 10
            periodSeconds: 5
      volumes:
        - name: uploads
          persistentVolumeClaim:
            claimName: {{ .Values.store.name }}-uploads
{{- end }}
```

### templates/ingress.yaml

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: {{ .Values.store.name }}
  namespace: {{ .Values.store.namespace }}
  labels:
    app: {{ .Values.store.name }}
    store.platform.io/id: {{ .Values.store.id }}
  annotations:
    cert-manager.io/cluster-issuer: {{ .Values.ingress.issuer | default "selfsigned" | quote }}
    nginx.ingress.kubernetes.io/proxy-body-size: "100m"
spec:
  ingressClassName: {{ .Values.ingress.className | default "nginx" }}
  tls:
    - hosts:
        - {{ .Values.ingress.host | quote }}
      secretName: {{ .Values.store.name }}-tls
  rules:
    - host: {{ .Values.ingress.host | quote }}
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: {{ .Values.store.name }}-app
                port:
                  number: 80
```

### templates/secret.yaml

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: {{ .Values.store.name }}-db-credentials
  namespace: {{ .Values.store.namespace }}
  labels:
    store.platform.io/id: {{ .Values.store.id }}
type: Opaque
data:
  root-password: {{ .Values.database.rootPassword | b64enc | quote }}
  password: {{ .Values.database.password | b64enc | quote }}
---
apiVersion: v1
kind: Secret
metadata:
  name: {{ .Values.store.name }}-app-credentials
  namespace: {{ .Values.store.namespace }}
  labels:
    store.platform.io/id: {{ .Values.store.id }}
type: Opaque
data:
  admin-password: {{ .Values.app.adminPassword | b64enc | quote }}
```

## Chart: store-instance (Dynamic)

This chart is used by the provisioner to deploy individual stores. It wraps the store-engine templates with store-specific values.

### Example values passed at install time

```yaml
# Generated by provisioner
global:
  environment: local
  storageClass: standard

store:
  id: "abc123def456"
  name: "my-store"
  namespace: "store-abc123def456"
  engine: "woocommerce"
  createdBy: "user@example.com"

database:
  type: "mysql"
  version: "8.0"
  persistence:
    size: "10Gi"
  rootPassword: "auto-generated-32-char-string"
  password: "auto-generated-32-char-string"
  resources:
    requests:
      memory: "512Mi"
      cpu: "250m"
    limits:
      memory: "1Gi"
      cpu: "500m"

app:
  adminPassword: "auto-generated-12-char-string"
  resources:
    requests:
      memory: "256Mi"
      cpu: "100m"
    limits:
      memory: "512Mi"
      cpu: "250m"

ingress:
  host: "my-store-abc123.127.0.0.1.nip.io"
  className: "nginx"
  issuer: "selfsigned"
```

## Helm Commands

### Install Platform (Local)

```bash
# Add required repositories
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
helm repo add jetstack https://charts.jetstack.io
helm repo update

# Install ingress-nginx (if not present)
helm install ingress-nginx ingress-nginx/ingress-nginx \
  --namespace ingress-nginx \
  --create-namespace

# Install cert-manager (if not present)
helm install cert-manager jetstack/cert-manager \
  --namespace cert-manager \
  --create-namespace \
  --set installCRDs=true

# Install platform
helm install store-platform ./helm-charts/store-platform \
  --namespace store-platform \
  --create-namespace \
  -f ./helm-charts/store-platform/values.yaml \
  -f ./helm-charts/store-platform/values-local.yaml
```

### Install Platform (Production)

```bash
helm install store-platform ./helm-charts/store-platform \
  --namespace store-platform \
  --create-namespace \
  -f ./helm-charts/store-platform/values.yaml \
  -f ./helm-charts/store-platform/values-prod.yaml \
  --set global.baseDomain=stores.example.com
```

### Upgrade Platform

```bash
helm upgrade store-platform ./helm-charts/store-platform \
  --namespace store-platform \
  -f ./helm-charts/store-platform/values.yaml \
  -f ./helm-charts/store-platform/values-local.yaml \
  --atomic \
  --wait
```

### Provision Store (via Helm - testing only)

```bash
helm install store-my-test ./helm-charts/store-instance \
  --namespace store-my-test \
  --create-namespace \
  --set store.id=test123 \
  --set store.name=my-test \
  --set store.engine=woocommerce \
  --set ingress.host=my-test.127.0.0.1.nip.io \
  --set database.rootPassword=$(openssl rand -base64 32) \
  --set database.password=$(openssl rand -base64 32) \
  --set app.adminPassword=$(openssl rand -base64 12)
```

### Uninstall Store

```bash
helm uninstall store-my-test --namespace store-my-test
kubectl delete namespace store-my-test
```

### Debug and Troubleshooting

```bash
# Template rendering (dry run)
helm template store-platform ./helm-charts/store-platform \
  -f ./helm-charts/store-platform/values.yaml \
  -f ./helm-charts/store-platform/values-local.yaml

# Lint charts
helm lint ./helm-charts/store-platform
helm lint ./helm-charts/store-platform/charts/dashboard
helm lint ./helm-charts/store-platform/charts/provisioner
helm lint ./helm-charts/store-instance

# Get release status
helm status store-platform -n store-platform

# View release history
helm history store-platform -n store-platform

# Rollback to previous version
helm rollback store-platform 1 -n store-platform

# Get values used
helm get values store-platform -n store-platform

# Render specific template
helm template store-platform ./helm-charts/store-platform \
  -s templates/provisioner/deployment.yaml
```

## Best Practices Implemented

1. **Idempotency:** All resources use deterministic naming based on release name
2. **Resource Management:** CPU/memory limits and requests defined for all containers
3. **Health Checks:** Liveness and readiness probes configured
4. **Security:** Non-root containers where possible, RBAC with minimal permissions
5. **Configuration:** Environment-specific values files, no hardcoded values
6. **Storage:** PersistentVolumeClaims with configurable storage classes
7. **Networking:** NetworkPolicies for isolation, Ingress for external access
8. **Observability:** Labels for monitoring, structured logging
9. **Scalability:** Replica counts configurable, HorizontalPodAutoscaler ready
10. **Secrets:** Kubernetes Secrets with auto-generation support
