kind delete cluster --name kube-demo
kind create cluster --image kindest/node:v1.29.4 --name kube-demo --config kind.yaml
kubectl apply -f config.yaml
kubectl apply -f deployment.yaml
kubectl apply -f svc.yaml
kubectl apply -f load-balancer.yaml