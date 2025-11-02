#!/bin/bash

# Civo Cloud Deployment Script
# This script deploys the kube-demo application to Civo Cloud

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    print_status "Checking prerequisites..."

    if ! command -v civo &> /dev/null; then
        print_error "Civo CLI is not installed. Please install it from https://civo.com/get"
        exit 1
    fi

    if ! command -v kubectl &> /dev/null; then
        print_error "kubectl is not installed. Please install it."
        exit 1
    fi

    if ! command -v helm &> /dev/null; then
        print_error "Helm is not installed. Please install it."
        exit 1
    fi

    print_success "Prerequisites check passed!"
}

# Setup Civo cluster
setup_civo_cluster() {
    print_status "Setting up Civo Kubernetes cluster..."
    kubectl get nodes
    print_success "Civo cluster setup complete!"
}

# Install Nginx Ingress Controller
install_ingress_controller() {
    print_status "Installing Nginx Ingress Controller..."

    # Add Helm repo
    helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx || true
    helm repo update

    # Install ingress controller
    helm install ingress-nginx ingress-nginx/ingress-nginx \
        --namespace ingress-nginx \
        --create-namespace \
        --set controller.service.type=LoadBalancer \
        --set controller.service.externalTrafficPolicy=Local \
        --set controller.publishService.enabled=true \
        --wait

    # Wait for ingress controller to be ready
    print_status "Waiting for Ingress Controller to be ready..."
    kubectl wait --namespace ingress-nginx \
        --for=condition=ready pod \
        --selector=app.kubernetes.io/component=controller \
        --timeout=300s

    # Get external IP
    print_status "Getting LoadBalancer external IP..."
    INGRESS_IP=""
    for i in {1..30}; do
        INGRESS_IP=$(kubectl get svc ingress-nginx-controller \
            -n ingress-nginx \
            -o jsonpath='{.status.loadBalancer.ingress[0].ip}' 2>/dev/null || echo "")

        if [ -n "$INGRESS_IP" ]; then
            break
        fi

        print_status "Waiting for external IP... (attempt $i/30)"
        sleep 10
    done

    if [ -z "$INGRESS_IP" ]; then
        print_error "Failed to get external IP for LoadBalancer"
        exit 1
    fi

    print_success "Nginx Ingress Controller installed!"
    print_success "External IP: $INGRESS_IP"
}

# Install ArgoCD
install_argocd() {
    print_status "Installing ArgoCD..."

    # Create namespace
    kubectl create namespace argocd --dry-run=client -o yaml | kubectl apply -f -

    # Install ArgoCD
    kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml

    # Wait for ArgoCD to be ready
    print_status "Waiting for ArgoCD to be ready..."
    kubectl wait --namespace argocd \
        --for=condition=available --timeout=300s \
        deployment/argocd-server

    # Get admin password
    ARGOCD_PASSWORD=$(kubectl -n argocd get secret argocd-initial-admin-secret \
        -o jsonpath="{.data.password}" | base64 -d)

    print_success "ArgoCD installed!"
    print_success "Admin password: $ARGOCD_PASSWORD"
}

# Deploy application
deploy_application() {
    print_status "Deploying application..."

    # Apply ArgoCD application
    kubectl apply -f argoCd.yaml

    # Wait a moment for ArgoCD to process
    sleep 5

    print_success "Application deployment initiated!"
}

# Show access information
show_access_info() {
    print_success "Deployment complete!"
    echo ""
    print_status "Access your services at:"
    echo " Frontend:     http://kube-demo.abhi07.xyz"
    echo " API:          http://api.kube-demo.abhi07.xyz"
    echo " Grafana:      http://grafana.kube-demo.abhi07.xyz"
    echo " Prometheus:   http://prometheus.kube-demo.abhi07.xyz"
    echo " Loki:         http://loki.kube-demo.abhi07.xyz"
    echo " ArgoCD:       http://argocd.kube-demo.abhi07.xyz"
    echo ""
    print_warning "Note: Replace 'kube-demo.abhi07.xyz' with your actual domain or use:"
    echo " Frontend:     http://$INGRESS_IP.nip.io"
    echo " API:          http://api.$INGRESS_IP.nip.io"
    echo " Grafana:      http://grafana.$INGRESS_IP.nip.io"
    echo " Prometheus:   http://prometheus.$INGRESS_IP.nip.io"
    echo " Loki:         http://loki.$INGRESS_IP.nip.io"
    echo " ArgoCD:       http://argocd.$INGRESS_IP.nip.io"
    echo ""
    print_status "ArgoCD credentials:"
    echo " URL:          http://argocd.kube-demo.abhi07.xyz"
    echo " Username:     admin"
    echo " Password:     $ARGOCD_PASSWORD"
    echo ""
    print_status "To check deployment status:"
    echo " kubectl get pods -A"
    echo " kubectl get application -n argocd"
    echo ""
    print_status "To cleanup:"
    echo " civo kubernetes delete kube-demo"
}

# Main execution
main() {
    echo "=========================================="
    echo "🚀 Deploying kube-demo to Civo Cloud"
    echo "=========================================="

    check_prerequisites
    setup_civo_cluster
    install_ingress_controller
    install_argocd
    deploy_application
    show_access_info

    echo "=========================================="
    print_success "Deployment completed successfully! 🎉"
    echo "=========================================="
}

# Run main function
main "$@"