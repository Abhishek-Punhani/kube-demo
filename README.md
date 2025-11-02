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

   - Frontend: http://localhost:2000
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

### Local Development (Kind)

1. Create Kind cluster and apply manifests (automated):

   ```bash
   ./k8s/start.sh
   ```

2. Access services:
   - Frontend: http://localhost
   - Demo Server API: http://api.localhost
   - Grafana: http://grafana.localhost
   - Prometheus: http://prometheus.localhost
   - Loki: http://loki.localhost
   - Redis: localhost:6379 (internal only)

### Cloud Deployment (Civo)

1. Deploy to Civo Cloud with external domain access:

   ```bash
   ./k8s/civo.sh
   ```

2. Access services (replace `your-domain.com` with your domain or use nip.io):
   - Frontend: http://your-domain.com
   - Demo Server API: http://api.your-domain.com
   - Grafana: http://grafana.your-domain.com
   - Prometheus: http://prometheus.your-domain.com
   - Loki: http://loki.your-domain.com
   - ArgoCD: http://argocd.your-domain.com

   See `k8s/DEPLOY_TO_CIVO.md` for detailed instructions.

## Monitoring Stack

The project includes a complete observability setup with Prometheus, Grafana, and Loki for metrics collection, visualization, and log aggregation.

### Accessing Monitoring Services

After deploying to Kubernetes, access the monitoring stack:

- **Grafana** (Dashboards & Visualization): http://grafana.localhost
  - Default login: `admin` / `admin` (or get password: `kubectl get secret --namespace monitoring grafana -o jsonpath="{.data.admin-password}" | base64 --decode ; echo`)
  - Pre-configured datasources for Prometheus and Loki

- **Prometheus** (Metrics Collection): http://prometheus.localhost
  - Scrapes metrics from demo-server at `/metrics` endpoint
  - Query metrics with PromQL

- **Loki** (Log Aggregation): http://loki.localhost
  - Receives logs from demo-server via HTTP API
  - Query logs with LogQL in Grafana

### Monitoring Features

#### Metrics (Prometheus)

- **Application Metrics**: HTTP request counts, response times, error rates
- **System Metrics**: Default Node.js and system metrics
- **Custom Metrics**: Request duration histograms, total request counters

#### Dashboards (Grafana)

- **Node.js Application Dashboard**: Pre-built dashboard for application metrics
- **Prometheus Metrics**: System and application performance graphs
- **Custom Dashboards**: Create additional dashboards for your needs

#### Logging (Loki)

- **Structured Logs**: Application logs with labels and metadata
- **Log Queries**: Search and filter logs by service, level, or content
- **Log Correlation**: Link logs with metrics in Grafana

### Configuration

#### Prometheus Configuration

- Scrapes demo-server every 15 seconds
- Metrics endpoint: `http://demo-server-clusterip:4000/metrics`
- Configuration stored in `k8s/config.yaml` (prometheus.yml)

#### Grafana Datasources

- **Prometheus**: `http://prometheus-clusterip:9090`
- **Loki**: `http://grafana-loki-clusterip:3100`
- Auto-configured via ConfigMap in `k8s/config.yaml`

#### Loki Configuration

- Receives logs via HTTP API at `/loki/api/v1/push`
- Stores logs in filesystem-based storage
- Configuration in `k8s/config.yaml` (loki-config.yaml)

### Usage Examples

#### Querying Metrics in Prometheus

```promql
# Total HTTP requests
http_requests_total

# Request duration percentiles
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))

# Error rate
rate(http_requests_total{status_code=~"5.."}[5m])
```

#### Querying Logs in Grafana/Loki

```logql
# All demo-server logs
{app="demo-server"}

# Error logs
{app="demo-server"} |= "error"

# Logs with specific message
{app="demo-server"} |~ "connected to Redis"
```

#### Creating Dashboards

1. In Grafana, click "Create" → "Dashboard"
2. Add panels with Prometheus queries
3. Use Loki for log visualization panels
4. Save and share dashboards

### Troubleshooting

#### Prometheus Not Scraping

```bash
# Check if demo-server is exposing metrics
kubectl exec deployment/demo-server-deploy -- curl http://localhost:4000/metrics

# Check Prometheus targets
kubectl port-forward svc/prometheus-clusterip 9090:9090
# Visit http://localhost:9090/targets
```

#### Grafana Datasource Issues

```bash
# Test datasource connectivity
kubectl exec deployment/grafana-deploy -- wget -qO- http://prometheus-clusterip:9090/api/v1/status/config

# Check Grafana logs
kubectl logs -f deployment/grafana-deploy
```

#### Loki Not Receiving Logs

```bash
# Check Loki readiness
kubectl exec deployment/grafana-deploy -- wget -qO- http://grafana-loki-clusterip:3100/ready

# Verify demo-server is sending logs
kubectl logs deployment/demo-server-deploy | grep -i loki
```

## ArgoCD GitOps Deployment

The project includes ArgoCD for GitOps-based deployment management.

### Setting Up ArgoCD

1. ArgoCD is automatically installed when running `./k8s/start.sh` (local) or `./k8s/civo.sh` (cloud)

2. Access ArgoCD UI:
   - **Local (Kind)**: http://localhost:8080 (port-forwarded)
   - **Cloud (Civo)**: http://argocd.your-domain.com
   - Username: admin
   - Password: Retrieved automatically during setup (shown in terminal)

3. The `kube-demo` application is automatically created and configured to:
   - Sync from the `k8s/` directory in this repository
   - Deploy to the `default` namespace
   - Auto-sync changes with pruning and self-healing enabled

### ArgoCD Application Structure

The ArgoCD application deploys:

- ConfigMaps (`config.yaml`)
- Deployments (`deployment.yaml`)
- Services (`clusterIp.yaml`)
- Ingress (`ingress.yaml`)
- Metrics Server (`metrics-server.yaml`)

Excluded from ArgoCD deployment:

- `kind.yaml` (Kind cluster configuration)
- `start.sh` (setup script)
- `argoCd.yaml` (ArgoCD application itself)
- `legacy/` directory (old configurations)

### Managing Deployments with ArgoCD

- **Manual Sync**: Click "Sync" in ArgoCD UI to manually deploy changes
- **Auto-sync**: Enabled by default - changes to the repository automatically deploy
- **Rollback**: Use ArgoCD UI to rollback to previous versions
- **Monitoring**: Check sync status and health in ArgoCD dashboard

## Scripts

- `pnpm run dev`: Start development servers.
- `pnpm run build`: Build all apps.
- `docker compose up --build`: Run with containers.
- `kind create cluster --config k8s/kind.yaml`: Set up K8s cluster.
- `./k8s/start.sh`: Complete setup with Kind cluster, ArgoCD, and all services (local).
- `./k8s/civo.sh`: Deploy to Civo Cloud with external domain access.

## Notes

- LoadBalancer services in Kind require MetalLB for external IPs.
- Configs are in `k8s/config.yaml` (ConfigMaps/Secrets).
- Images are assumed to be built/pushed (e.g., `punhaniabhishek/kube-demo:*`).
