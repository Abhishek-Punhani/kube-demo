#!/bin/bash

# If getting error try to stop running services on these ports: 80, 443

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

# Apply application configs
echo "Applying application configurations..."
kubectl apply -f config.yaml
kubectl apply -f deployment.yaml
kubectl apply -f clusterIp.yaml
kubectl apply -f ingress.yaml
kubectl apply -f metrics-server.yaml

echo "Deployment complete!"
echo ""
echo "Access your services at:"
echo "  Frontend:     http://localhost"
echo "  Demo Server:  http://localhost/api"
echo "  Grafana:      http://localhost/grafana"
echo "  Prometheus:   http://localhost/prometheus"
echo "  Loki:         http://localhost/loki"
echo ""
echo "Wait a few moments for all pods to be ready, then check with:"
echo "  kubectl get pods -A"