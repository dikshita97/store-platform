#!/bin/bash
# scripts/setup-k3d.sh
# Setup k3d cluster for local development

set -e

CLUSTER_NAME="${CLUSTER_NAME:-store-platform}"
K3D_VERSION="${K3D_VERSION:-v5.6.0}"

echo "🚀 Setting up k3d cluster for Store Provisioning Platform..."

# Check if k3d is installed
if ! command -v k3d &> /dev/null; then
    echo "❌ k3d not found. Installing..."
    wget -q -O - https://raw.githubusercontent.com/k3d-io/k3d/main/install.sh | TAG=$K3D_VERSION bash
fi

# Check if kubectl is installed
if ! command -v kubectl &> /dev/null; then
    echo "❌ kubectl not found. Please install kubectl first."
    echo "   Visit: https://kubernetes.io/docs/tasks/tools/"
    exit 1
fi

# Check if Helm is installed
if ! command -v helm &> /dev/null; then
    echo "❌ Helm not found. Please install Helm first."
    echo "   Visit: https://helm.sh/docs/intro/install/"
    exit 1
fi

# Delete existing cluster if it exists
if k3d cluster list | grep -q "$CLUSTER_NAME"; then
    echo "⚠️  Cluster '$CLUSTER_NAME' already exists. Deleting..."
    k3d cluster delete "$CLUSTER_NAME"
fi

# Create k3d cluster
echo "📦 Creating k3d cluster '$CLUSTER_NAME'..."
k3d cluster create "$CLUSTER_NAME" \
    --servers 1 \
    --agents 1 \
    --port "80:80@loadbalancer" \
    --port "443:443@loadbalancer" \
    --k3s-arg "--disable=traefik@server:0" \
    --k3s-arg "--tls-san=host.k3d.internal@server:0" \
    --volume "$(pwd)/helm:/charts@all"

# Wait for cluster to be ready
echo "⏳ Waiting for cluster to be ready..."
sleep 10
kubectl wait --for=condition=Ready node --all --timeout=120s

# Install NGINX Ingress Controller
echo "📥 Installing NGINX Ingress Controller..."
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/main/deploy/static/provider/cloud/deploy.yaml

# Wait for ingress controller
echo "⏳ Waiting for ingress controller..."
kubectl wait --namespace ingress-nginx \
    --for=condition=ready pod \
    --selector=app.kubernetes.io/component=controller \
    --timeout=180s

# Install cert-manager
echo "📥 Installing cert-manager..."
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.13.2/cert-manager.yaml

# Wait for cert-manager
echo "⏳ Waiting for cert-manager..."
kubectl wait --namespace cert-manager \
    --for=condition=ready pod \
    --selector=app.kubernetes.io/instance=cert-manager \
    --timeout=180s

# Create ClusterIssuer for self-signed certificates
cat <<EOF | kubectl apply -f -
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: selfsigned
spec:
  selfSigned: {}
EOF

# Create platform namespace
kubectl create namespace store-platform --dry-run=client -o yaml | kubectl apply -f -

echo ""
echo "✅ k3d cluster '$CLUSTER_NAME' is ready!"
echo ""
echo "📝 Next steps:"
echo "   1. Install the platform: npm run install:platform"
echo "   2. Access dashboard: http://dashboard.127.0.0.1.nip.io"
echo "   3. Access API: http://api.127.0.0.1.nip.io"
echo ""
echo "📊 Cluster info:"
kubectl cluster-info
echo ""
echo "🔧 Useful commands:"
echo "   kubectl get nodes"
echo "   kubectl get pods -A"
echo "   k3d cluster delete $CLUSTER_NAME"
