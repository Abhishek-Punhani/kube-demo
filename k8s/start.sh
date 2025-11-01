#!/bin/bash

# If getting error try to stop running services on these ports: 80, 443
# sudo systemctl stop nginx redis mysql
# Using kind to create a local kubernetes cluster
kind delete cluster --name kube-demo
kind create cluster --image kindest/node:v1.29.4 --name kube-demo --config kind.yaml

# Install Nginx Ingress Controller
echo "Installing Nginx Ingress Controller..."
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/main/deploy/static/provider/kind/deploy.yaml

# Wait for ingress controller to be ready
echo "Waiting for Ingress Controller to be ready..."
kubectl wait --namespace ingress-nginx \
  --for=condition=ready pod \
  --selector=app.kubernetes.io/component=controller \
  --timeout=90s

# Add ArgoCd
echo "Installing ArgoCD..."
kubectl create namespace argocd || true
helm repo add argo https://argoproj.github.io/argo-helm
helm repo update
helm install argocd argo/argo-cd \
  --namespace argocd \
  --version 7.6.12 \
  --set server.service.type=ClusterIP \
  --wait
# Wait for ArgoCD server to be ready
echo "Waiting for ArgoCD to be ready..."
kubectl wait --namespace argocd \
  --for=condition=ready pod \
  --selector=app.kubernetes.io/name=argocd-server \
  --timeout=120s
# Port-forward ArgoCD server
kubectl port-forward svc/argocd-server -n argocd 8080:80 &
echo "ArgoCD is available at http://localhost:8080 (username: admin, password: $(kubectl get secret argocd-initial-admin-secret -n argocd -o jsonpath="{.data.password}" | base64 -d))"
echo "ArgoCD initial admin password:"
echo "-------------------------------------"
kubectl get secret argocd-initial-admin-secret -n argocd -o jsonpath="{.data.password}" | base64 -d
echo "-------------------------------------"
echo ""

# Apply application configs
echo "Applying application configurations..."
kubectl apply -f argoCd.yaml
kubectl apply -f metrics-server.yaml

echo "Deployment complete!"
echo ""
echo "Access your services at:"
echo " frontend :  http://localhost/"
echo " demo server :  http://api.localhost"
echo "  grafana :     http://grafana.localhost"
echo "  prometheus :  http://prometheus.localhost"
echo "  loki :        http://loki.localhost"
echo ""

echo "Wait a few moments for all pods to be ready, then check with:"
echo "  kubectl get pods -A"