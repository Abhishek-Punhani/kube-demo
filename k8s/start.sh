# If getting error try to stop running services on these ports: 80, 4000, 6379, 9090, 3000, 3100

# Using kind to create a local kubernetes cluster
kind delete cluster --name kube-demo
kind create cluster --image kindest/node:v1.29.4 --name kube-demo --config kind.yaml
kubectl apply -f config.yaml
kubectl apply -f deployment.yaml
kubectl apply -f clusterIp.yaml
kubectl apply -f nodePort.yaml
kubectl apply -f load-balancer.yaml
kubectl apply -f metrics-server.yaml