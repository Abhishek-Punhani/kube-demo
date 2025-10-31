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

## Monitoring Stack

The project includes a complete observability setup with Prometheus, Grafana, and Loki for metrics collection, visualization, and log aggregation.

### Accessing Monitoring Services

After deploying to Kubernetes, access the monitoring stack:

- **Grafana** (Dashboards & Visualization): http://localhost:3000
  - Default login: `admin` / `admin`
  - Pre-configured datasources for Prometheus and Loki

- **Prometheus** (Metrics Collection): http://localhost:9090
  - Scrapes metrics from demo-server at `/metrics` endpoint
  - Query metrics with PromQL

- **Loki** (Log Aggregation): http://localhost:3100
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
