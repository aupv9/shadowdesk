# Docker Setup & Deployment Guide

**Last Updated**: 2026-04-13

This guide covers setting up and deploying Ghost Browser server and Common SaaS services using Docker.

---

## Project Structure

```
shadowdesk/server/           ← Ghost Browser API Server (Node.js/Express)
├── docker/
│   └── Dockerfile          ← Production build
├── docker-compose.yml      ← Local development stack
└── .env                    ← Environment variables

common-sass/                ← Shared SaaS Backend (Go microservices)
├── cmd/
│   ├── profile-service/
│   │   └── Dockerfile      ← Profile Service (Go)
│   ├── automation-service/
│   │   └── Dockerfile      ← Automation Service (Go)
│   ├── detection-service/
│   │   └── Dockerfile      ← Detection Service (Go)
│   ├── api-gateway/
│   │   └── Dockerfile      ← API Gateway
│   ├── service-registry/
│   │   └── Dockerfile      ← Service Registry
│   └── worker/
│       └── Dockerfile      ← Worker
├── docker-compose.yml      ← Full development stack
└── .env                    ← Environment variables
```

---

## Architecture

### Network Configuration

```
┌─────────────────────────────────────────────────┐
│  Ghost Browser Desktop (Electron)               │
│  Port 9080                                      │
└────────────────────┬────────────────────────────┘
                     │ HTTP API Calls
                     ▼
        ┌────────────────────────────┐
        │  shadowdesk/server         │
        │  (Port 3000)               │
        │  ├─ Auth Endpoints         │
        │  ├─ Profile/Workflow/      │
        │  │  Detection (bridges)    │
        │  ├─ Team, Sync             │
        │  └─ License                │
        └────────┬───────────────────┘
                 │ gRPC/HTTP
                 ▼
      ┌──────────────────────────────┐
      │  Common SaaS Microservices   │
      │  (Port 8080 - API Gateway)   │
      ├──────────────────────────────┤
      │  ├─ Profile Service (5010)   │
      │  ├─ Automation Service (5011)│
      │  ├─ Detection Service (5012) │
      │  ├─ Auth Service             │
      │  ├─ User Service             │
      │  └─ ... other services       │
      ├──────────────────────────────┤
      │  Infrastructure:             │
      │  ├─ PostgreSQL (5432)        │
      │  ├─ Redis (6379)             │
      │  ├─ Jaeger (16686)           │
      │  ├─ Prometheus (9090)        │
      │  ├─ Grafana (3000*)          │
      │  └─ Service Registry (4000)  │
      └──────────────────────────────┘
```

**Note**: Grafana is on port 3000 (conflicts with shadowdesk/server). Adjust if needed.

---

## Prerequisites

- Docker 20.10+
- Docker Compose 2.0+
- Go 1.21+ (for local development)
- Node.js 18+ (for local development)

---

## Quick Start

### 1. Start Common SaaS Stack

```bash
cd /home/user/common-sass

# Start all services (postgres, redis, gateway, 3 ghost browser services, monitoring)
docker-compose up -d

# Verify services are healthy
docker-compose ps
docker-compose logs service-registry  # Should show registration messages
docker-compose logs profile-service   # Check if running on 5010
```

**Expected Output**:
```
NAME                               COMMAND                  SERVICE             STATUS      PORTS
common-sass-alertmanager           /bin/alertmanager --c…   alertmanager        Up          9093/tcp
common-sass-api-gateway            ./api-gateway            api-gateway         Up          0.0.0.0:8080->8080/tcp
common-sass-automation-service      ./automation-service     automation-service  Up          0.0.0.0:5011->5011/tcp
common-sass-cache                  redis-server --appen…   redis               Up          0.0.0.0:6379->6379/tcp
common-sass-db                      postgres                postgres            Up          0.0.0.0:5432->5432/tcp
common-sass-detection-service       ./detection-service     detection-service   Up          0.0.0.0:5012->5012/tcp
common-sass-grafana                /run.sh                  grafana             Up          0.0.0.0:3000->3000/tcp
common-sass-jaeger                 /go/bin/all-in-one       jaeger              Up          0.0.0.0:16686->16686/tcp
common-sass-profile-service         ./profile-service       profile-service     Up          0.0.0.0:5010->5010/tcp
common-sass-prometheus              /bin/prometheus --co…   prometheus          Up          0.0.0.0:9090->9090/tcp
common-sass-registry               ./service-registry      service-registry    Up          0.0.0.0:4000->4000/tcp
common-sass-worker                 /app/worker             worker              Up
```

### 2. Start Ghost Browser Server

```bash
cd /home/user/shadowdesk/server

# Copy environment file
cp .env.example .env  # or use the provided .env

# Start the server stack
docker-compose up -d

# Verify services
docker-compose ps
docker-compose logs api  # Check startup logs
```

**Expected Output**:
```
NAME                            COMMAND                  SERVICE     STATUS      PORTS
ghost-browser-api              npm run dev              api         Up          0.0.0.0:3000->3000/tcp
ghost-browser-pgadmin          /entrypoint.sh           pgadmin     Up          0.0.0.0:5050->80/tcp
ghost-browser-postgres          postgres 14             postgres    Up          0.0.0.0:5432->5432/tcp
ghost-browser-redis             redis-server            redis       Up          0.0.0.0:6379->6379/tcp
```

---

## Health Checks

### Common SaaS Services

```bash
# API Gateway
curl http://localhost:8080/health

# Service Registry
curl http://localhost:4000/health

# Profile Service
curl http://localhost:5010/health

# Automation Service
curl http://localhost:5011/health

# Detection Service
curl http://localhost:5012/health
```

### Ghost Browser Server

```bash
# Health endpoint
curl http://localhost:3000/health/live
curl http://localhost:3000/health/ready
```

### Databases

```bash
# PostgreSQL (for shadowdesk)
psql postgresql://postgres:dev_password@localhost:5432/ghost_browser

# PostgreSQL (for common-sass)
psql postgresql://postgres:postgres@localhost:5432/common_sass

# Redis
redis-cli ping
```

---

## Testing API Endpoints

### 1. Register & Login (shadowdesk/server)

```bash
# Register
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "TestPassword123!",
    "full_name": "Test User"
  }'

# Response:
# {
#   "user": {
#     "id": "...",
#     "email": "user@example.com",
#     "full_name": "Test User",
#     ...
#   },
#   "tokens": {
#     "access_token": "eyJ...",
#     "refresh_token": "...",
#     "expires_at": 1234567890
#   }
# }

# Login
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "TestPassword123!"
  }'
```

### 2. Create Browser Profile (via shadowdesk/server bridge)

```bash
# Get token from login response
TOKEN="eyJ..."

# Create profile
curl -X POST http://localhost:3000/profiles \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Profile",
    "fingerprint_preset": "win10-chrome120",
    "fingerprint_config": {},
    "proxy_config": null
  }'

# Response: Profile created via Profile Service (port 5010)
```

### 3. Create Automation Workflow

```bash
# Create workflow
curl -X POST http://localhost:3000/workflows \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Workflow",
    "description": "Test workflow",
    "steps": [
      {
        "type": "navigate",
        "url": "https://example.com"
      },
      {
        "type": "click",
        "selector": "button"
      }
    ]
  }'
```

### 4. Create Detection Test

```bash
# Create test
curl -X POST http://localhost:3000/detection \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "profile_id": "...",
    "profile_name": "My Profile"
  }'

# Response: Test created and queued
```

---

## Monitoring & Debugging

### View Logs

```bash
# Common SaaS services
docker-compose -f /home/user/common-sass/docker-compose.yml logs -f profile-service
docker-compose -f /home/user/common-sass/docker-compose.yml logs -f automation-service
docker-compose -f /home/user/common-sass/docker-compose.yml logs -f detection-service

# Ghost Browser server
docker-compose -f /home/user/shadowdesk/server/docker-compose.yml logs -f api

# All services
docker-compose logs -f
```

### Access Monitoring Dashboards

- **Grafana** (Common SaaS metrics): http://localhost:3000
  - Username: admin
  - Password: admin
  
- **Prometheus** (Metrics): http://localhost:9090
  - Query metrics by service

- **Jaeger** (Distributed Tracing): http://localhost:16686
  - Trace requests across services

- **pgAdmin** (Database): http://localhost:5050
  - Email: admin@example.com
  - Password: admin

### Database Inspection

```bash
# Connect to shadowdesk database
docker exec -it ghost-browser-postgres psql -U postgres -d ghost_browser

# Connect to common-sass database
docker exec -it common-sass-db psql -U postgres -d common_sass

# Common queries
\dt                           # List tables
SELECT * FROM users LIMIT 5;  # View users
\d profiles                    # Describe table structure
```

---

## Development Workflow

### Rebuild Services

```bash
# Rebuild specific service after code changes
docker-compose build profile-service
docker-compose up -d profile-service

# Or rebuild everything
docker-compose build
docker-compose up -d
```

### Hot Reloading

- **shadowdesk/server**: Auto-reloads via nodemon (npm run dev)
- **common-sass**: Services need rebuild (Go is compiled)

```bash
# For Go services, rebuild after changes
docker-compose build profile-service
docker-compose up -d profile-service

# Check logs
docker-compose logs -f profile-service
```

### Execute Commands in Containers

```bash
# Run Go commands in profile-service
docker exec common-sass-profile-service /bin/sh

# Run npm commands in ghost-browser-api
docker exec ghost-browser-api npm list

# Run migrations
docker exec common-sass-profile-service ./migrate up
```

---

## Troubleshooting

### Service fails to start

```bash
# Check logs
docker-compose logs -f <service-name>

# Rebuild
docker-compose build <service-name>

# Restart
docker-compose restart <service-name>
```

### Database connection errors

```bash
# Verify database is healthy
docker-compose ps postgres
docker-compose logs postgres

# Check connection string in .env
# DATABASE_URL should match: postgres://user:pass@host:5432/dbname

# Manually test connection
docker exec -it common-sass-db psql -U postgres -d common_sass
```

### Services can't communicate

```bash
# Ensure networks are correct
docker network ls
docker network inspect common-sass
docker network inspect ghost-browser

# Check if containers can reach each other
docker exec ghost-browser-api curl http://api-gateway:8080/health
docker exec common-sass-profile-service curl http://service-registry:4000/health
```

### Port conflicts

```bash
# Find what's using port 3000
lsof -i :3000

# Kill process or change port in docker-compose.yml
# Change "3000:3000" to "3001:3000" to use external port 3001
```

---

## Cleanup

```bash
# Stop all services
docker-compose -f /home/user/common-sass/docker-compose.yml down
docker-compose -f /home/user/shadowdesk/server/docker-compose.yml down

# Remove volumes (delete data)
docker-compose down -v

# Remove all unused Docker resources
docker system prune -a

# Full reset (remove everything)
docker-compose down -v --remove-orphans
```

---

## Production Deployment

### Environment Variables

Update `.env` files with production values:

```bash
# common-sass/.env
JWT_SECRET=<strong-random-secret>
DATABASE_URL=postgres://user:secure_pass@prod-db:5432/common_sass
REDIS_ADDR=prod-redis:6379
OTEL_EXPORTER_OTLP_ENDPOINT=http://prod-jaeger:4318

# shadowdesk/server/.env
JWT_SECRET=<strong-random-secret>
DATABASE_URL=postgres://user:secure_pass@prod-db:5432/ghost_browser
GHOST_API_URL=https://api.ghostbrowser.app  # Production common-sass
SENDGRID_API_KEY=<api-key>
STRIPE_SECRET_KEY=<secret-key>
```

### Docker Build & Push

```bash
# Build images
docker-compose -f common-sass/docker-compose.yml build
docker-compose -f shadowdesk/server/docker-compose.yml build

# Tag for registry
docker tag common-sass-profile-service myregistry/ghost-browser-profile:latest
docker tag common-sass-api-gateway myregistry/ghost-browser-gateway:latest

# Push to registry
docker push myregistry/ghost-browser-profile:latest
docker push myregistry/ghost-browser-gateway:latest
```

### Deploy to Kubernetes (optional)

See `K8S_DEPLOYMENT.md` for Kubernetes setup.

---

## Service Endpoints Summary

| Service | URL | Port | Purpose |
|---------|-----|------|---------|
| API Gateway | http://api-gateway:8080 | 8080 | Route to backend services |
| Profile Service | http://profile-service:5010 | 5010 | Browser profile CRUD |
| Automation Service | http://automation-service:5011 | 5011 | Workflow automation |
| Detection Service | http://detection-service:5012 | 5012 | Anti-detection testing |
| Service Registry | http://service-registry:4000 | 4000 | Service discovery |
| ghostbrowser/server | http://localhost:3000 | 3000 | Ghost Browser API |
| Grafana | http://localhost:3000 | 3000 | Metrics dashboard |
| Prometheus | http://localhost:9090 | 9090 | Metrics DB |
| Jaeger | http://localhost:16686 | 16686 | Distributed tracing |
| PostgreSQL | localhost | 5432 | Data persistence |
| Redis | localhost | 6379 | Caching/Queue |

---

## Next Steps

1. ✅ Start Docker services (this guide)
2. ⬜ Run integration tests
3. ⬜ Configure CI/CD pipelines
4. ⬜ Set up monitoring alerts
5. ⬜ Deploy to production

---

**Questions or Issues?**  
Check logs: `docker-compose logs -f <service>`  
Verify connectivity: `curl http://<service>/health`  
Review `.env` configuration
