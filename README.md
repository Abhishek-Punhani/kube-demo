# Kube Demo

A full-stack demo application with a Node.js backend (demo-server), Next.js frontend (web), and Redis, containerized and deployable to Kubernetes (Kind).

## Project Structure

- `apps/demo-server/`: TypeScript Node.js server with Express, Socket.IO, and Redis queues.
- `apps/web/`: Next.js frontend app.
- `packages/`: Shared ESLint/TypeScript configs and UI components.
- `shared/`: Common utilities (auth, DB, queues, WebSocket).
- `k8s/`: Kubernetes manifests for Kind cluster deployment.
- `BasicScripts/`: Additional YAML examples- basic files used to learn.
- `docker-compose.yml`: Local development setup with services and Redis.

## Prerequisites

- Node.js 20+
- pnpm
- Docker & Docker Compose
- kubectl & Kind (for K8s deployment)

## Local Development

1. Install dependencies:

   ```bash
   pnpm install
   ```

2. Start services with Docker Compose:

   ```bash
   docker compose up --build
   ```

   - Frontend: http://localhost:3000
   - Demo-server: http://localhost:4000
   - Redis: localhost:6379

3. For development without Docker:

   ```bash
   # Terminal 1: Start demo-server
   cd apps/demo-server
   pnpm run dev

   # Terminal 2: Start web
   cd apps/web
   pnpm run dev

   # Terminal 3: Start Redis (if not using Docker)
   redis-server
   ```

## Kubernetes Deployment

1. Create Kind cluster and apply manifests (automated):

   ```bash
   ./k8s/start.sh
   ```

   Or manually:

   ```bash
   kind create cluster --name kube-demo --config k8s/kind.yaml
   kubectl apply -f k8s/config.yaml
   kubectl apply -f k8s/deployment.yaml
   kubectl apply -f k8s/svc.yaml
   kubectl apply -f k8s/load-balancer.yaml
   ```

2. Access services:
   - Frontend: http://localhost:80
   - Demo-server: http://localhost:4000
   - Redis: localhost:6379

3. Clean up:
   ```bash
   kind delete cluster --name kube-demo
   ```

## Scripts

- `pnpm run dev`: Start development servers.
- `pnpm run build`: Build all apps.
- `docker compose up --build`: Run with containers.
- `kind create cluster --config k8s/kind.yaml`: Set up K8s cluster.

## Notes

- LoadBalancer services in Kind require MetalLB for external IPs.
- Configs are in `k8s/config.yaml` (ConfigMaps/Secrets).
- Images are assumed to be built/pushed (e.g., `punhaniabhishek/kube-demo:*`).
