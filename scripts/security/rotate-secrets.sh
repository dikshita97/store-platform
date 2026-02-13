#!/bin/bash

# Secret Rotation Script for Store Provisioning Platform
# This script rotates secrets for stores and platform components

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to generate secure password
generate_password() {
    openssl rand -base64 32 | tr -d "=+/" | cut -c1-25
}

# Function to rotate MySQL credentials for a store
rotate_mysql_credentials() {
    local namespace=$1
    local secret_name="${namespace}-mysql-credentials"
    
    print_info "Rotating MySQL credentials for namespace: $namespace"
    
    # Generate new passwords
    local new_root_password=$(generate_password)
    local new_password=$(generate_password)
    
    # Create new secret with rotated credentials
    kubectl create secret generic $secret_name \
        --namespace=$namespace \
        --from-literal=root-password="$new_root_password" \
        --from-literal=password="$new_password" \
        --dry-run=client -o yaml | kubectl apply -f -
    
    # Restart MySQL to pick up new credentials
    kubectl rollout restart statefulset mysql --namespace=$namespace
    
    print_info "MySQL credentials rotated successfully for $namespace"
}

# Function to rotate WordPress salts
rotate_wordpress_salts() {
    local namespace=$1
    local secret_name="${namespace}-wordpress-secrets"
    
    print_info "Rotating WordPress salts for namespace: $namespace"
    
    # Generate new salts
    local auth_key=$(openssl rand -base64 48)
    local secure_auth_key=$(openssl rand -base64 48)
    local logged_in_key=$(openssl rand -base64 48)
    local nonce_key=$(openssl rand -base64 48)
    local auth_salt=$(openssl rand -base64 48)
    local secure_auth_salt=$(openssl rand -base64 48)
    local logged_in_salt=$(openssl rand -base64 48)
    local nonce_salt=$(openssl rand -base64 48)
    
    # Update secret
    kubectl create secret generic $secret_name \
        --namespace=$namespace \
        --from-literal=auth-key="$auth_key" \
        --from-literal=secure-auth-key="$secure_auth_key" \
        --from-literal=logged-in-key="$logged_in_key" \
        --from-literal=nonce-key="$nonce_key" \
        --from-literal=auth-salt="$auth_salt" \
        --from-literal=secure-auth-salt="$secure_auth_salt" \
        --from-literal=logged-in-salt="$logged_in_salt" \
        --from-literal=nonce-salt="$nonce_salt" \
        --dry-run=client -o yaml | kubectl apply -f -
    
    # Restart WordPress to pick up new salts
    kubectl rollout restart deployment wordpress --namespace=$namespace
    
    print_info "WordPress salts rotated successfully for $namespace"
}

# Function to rotate all store secrets
rotate_all_stores() {
    print_info "Starting secret rotation for all stores..."
    
    # Get all store namespaces
    local namespaces=$(kubectl get namespaces -l store-platform/type=store -o name | cut -d/ -f2)
    
    if [ -z "$namespaces" ]; then
        print_warning "No store namespaces found"
        return 0
    fi
    
    for namespace in $namespaces; do
        print_info "Processing namespace: $namespace"
        
        # Rotate MySQL credentials
        rotate_mysql_credentials $namespace
        
        # Rotate WordPress salts
        rotate_wordpress_salts $namespace
        
        # Wait for pods to be ready
        print_info "Waiting for pods to be ready in $namespace..."
        kubectl wait --for=condition=ready pod --all --namespace=$namespace --timeout=300s
        
        print_info "Completed rotation for $namespace"
        echo "---"
    done
    
    print_info "All store secrets rotated successfully!"
}

# Function to rotate platform secrets
rotate_platform_secrets() {
    print_info "Rotating platform secrets..."
    
    local platform_namespace="store-platform"
    
    # Check if platform namespace exists
    if ! kubectl get namespace $platform_namespace &> /dev/null; then
        print_warning "Platform namespace not found: $platform_namespace"
        return 0
    fi
    
    # Rotate API database credentials
    if kubectl get secret api-db-credentials --namespace=$platform_namespace &> /dev/null; then
        print_info "Rotating API database credentials..."
        local new_db_password=$(generate_password)
        
        kubectl patch secret api-db-credentials \
            --namespace=$platform_namespace \
            --type='json' \
            -p='[{"op": "replace", "path": "/data/password", "value":"'$(echo -n $new_db_password | base64)'"}]'
        
        # Restart API deployment
        kubectl rollout restart deployment api --namespace=$platform_namespace
        print_info "API database credentials rotated"
    fi
    
    print_info "Platform secrets rotated successfully!"
}

# Function to audit secret ages
audit_secrets() {
    print_info "Auditing secret ages..."
    
    echo ""
    echo "Secrets older than 90 days:"
    echo "Namespace | Secret Name | Age"
    echo "----------|-------------|-----"
    
    kubectl get secrets --all-namespaces -o json | \
        jq -r '.items[] | select(.metadata.creationTimestamp < "'$(date -d '90 days ago' -u +%Y-%m-%dT%H:%M:%SZ)'") | [.metadata.namespace, .metadata.name, .metadata.creationTimestamp] | @tsv' | \
        sort -k3 | \
        while read namespace name timestamp; do
            age_days=$(( ( $(date +%s) - $(date -d "$timestamp" +%s) ) / 86400 ))
            echo "$namespace | $name | ${age_days}d"
        done
    
    echo ""
}

# Main function
main() {
    echo "========================================"
    echo "Store Platform Secret Rotation Tool"
    echo "========================================"
    echo ""
    
    # Check if kubectl is available
    if ! command -v kubectl &> /dev/null; then
        print_error "kubectl is not installed or not in PATH"
        exit 1
    fi
    
    # Check if connected to cluster
    if ! kubectl cluster-info &> /dev/null; then
        print_error "Not connected to a Kubernetes cluster"
        exit 1
    fi
    
    # Parse command line arguments
    case "${1:-all}" in
        all)
            rotate_all_stores
            rotate_platform_secrets
            ;;
        stores)
            rotate_all_stores
            ;;
        platform)
            rotate_platform_secrets
            ;;
        audit)
            audit_secrets
            ;;
        help|--help|-h)
            echo "Usage: $0 [command]"
            echo ""
            echo "Commands:"
            echo "  all      - Rotate all secrets (default)"
            echo "  stores   - Rotate only store secrets"
            echo "  platform - Rotate only platform secrets"
            echo "  audit    - Audit secret ages"
            echo "  help     - Show this help message"
            echo ""
            echo "Examples:"
            echo "  $0              # Rotate all secrets"
            echo "  $0 stores       # Rotate only store secrets"
            echo "  $0 audit        # Check secret ages"
            exit 0
            ;;
        *)
            print_error "Unknown command: $1"
            echo "Run '$0 help' for usage information"
            exit 1
            ;;
    esac
    
    echo ""
    print_info "Secret rotation completed!"
}

# Run main function
main "$@"
