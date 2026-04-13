# Docker Deployment Checklist

**Status**: ✅ Configuration Complete  
**Date**: 2026-04-13

---

## Summary

Docker configuration has been set up for both Ghost Browser Server and Common SaaS microservices. All Dockerfiles and docker-compose configurations are ready for deployment.

---

## ✅ Completed Setup

### Common SaaS (Go Microservices)

| Component | Status | Details |
|-----------|--------|---------|
| docker-compose.yml | ✅ Updated | Added 3 Ghost Browser services |
| Profile Service Dockerfile | ✅ Created | Multi-stage Go build |
| Automation Service Dockerfile | ✅ Created | Multi-stage Go build |
| Detection Service Dockerfile | ✅ Created | Multi-stage Go build |
| .env file | ✅ Created | Development variables configured |
| Network setup | ✅ Configured | Bridge network for service communication |
| Health checks | ✅ Configured | HTTP health checks for each service |
| Logging | ✅ Configured | OTEL/Jaeger integration |
| Monitoring | ✅ Available | Prometheus, Grafana, Jaeger, AlertManager |

### Ghost Browser Server (Node.js/Express)

| Component | Status | Details |
|-----------|--------|---------|
| docker-compose.yml | ✅ Updated | Network and env vars updated |
| Dockerfile | ✅ Exists | Multi-stage Node build |
| .env file | ✅ Created | Development variables configured |
| Network setup | ✅ Configured | Bridges to common-sass via api-gateway |
| Database | ✅ Configured | PostgreSQL 14 with migrations |
| Cache | ✅ Configured | Redis for sessions/cache |
| Health checks | ✅ Configured | Live/ready endpoints |

### Deployment Scripts

| Script | Status | Purpose |
|--------|--------|---------|
| deploy.sh | ✅ Created | Master deployment script (Linux/Mac) |
| deploy.bat | ⬜ Pending | Windows batch script |
| docker-compose files | ✅ Complete | Full stack definitions |
| DOCKER_SETUP.md | ✅ Created | Comprehensive guide |

---

## Quick Start Commands

### For Linux/Mac

```bash
# Make script executable
chmod +x /home/user/deploy.sh

# Start all services
/home/user/deploy.sh start-all

# Check health
/home/user/deploy.sh health

# View logs
/home/user/deploy.sh logs

# Stop services
/home/user/deploy.sh stop-all
```

### For Windows (Git Bash)

```bash
cd /c/path/to/common-sass
docker-compose up -d

cd /c/path/to/shadowdesk/server
docker-compose up -d
```

---

## File Structure

```
/home/user/
├── DOCKER_SETUP.md               ← Setup & deployment guide
├── DEPLOYMENT_CHECKLIST.md       ← This file
├── deploy.sh                     ← Master deployment script
│
├── common-sass/
│   ├── docker-compose.yml        ← ✅ Updated with Ghost Browser services
│   ├── .env                      ← ✅ Created with dev variables
│   ├── cmd/
│   │   ├── profile-service/
│   │   │   └── Dockerfile        ← ✅ Created
│   │   ├── automation-service/
│   │   │   └── Dockerfile        ← ✅ Created
│   │   ├── detection-service/
│   │   │   └── Dockerfile        ← ✅ Created
│   │   ├── api-gateway/
│   │   │   └── Dockerfile        ← Already exists
│   │   ├── service-registry/
│   │   │   └── Dockerfile        ← Already exists
│   │   └── worker/
│   │       └── Dockerfile        ← Already exists
│   └── ... (other files)
│
└── shadowdesk/server/
    ├── docker-compose.yml        ← ✅ Updated with networks
    ├── .env                      ← ✅ Created with dev variables
    ├── docker/
    │   └── Dockerfile            ← Already exists
    └── ... (other files)
```

---

## Services Overview

### Common SaaS Stack (Ports 4000-5012, 9090-16686)

```
Service                    Port    Container Name              Status
────────────────────────────────────────────────────────────────────
PostgreSQL                 5432    common-sass-db              ✅
Redis                      6379    common-sass-cache           ✅
Service Registry           4000    common-sass-registry        ✅
API Gateway                8080    common-sass-gateway         ✅
Profile Service            5010    common-sass-profile-service ✅
Automation Service         5011    common-sass-automation-service ✅
Detection Service          5012    common-sass-detection-service ✅
Worker                     -       common-sass-worker         ✅
Jaeger                     16686   common-sass-jaeger         ✅
Prometheus                 9090    common-sass-prometheus     ✅
Grafana                    3000    common-sass-grafana        ✅
AlertManager               9093    common-sass-alertmanager   ✅
```

### Ghost Browser Server Stack (Ports 3000, 5432, 5050, 6379)

```
Service                    Port    Container Name                Status
────────────────────────────────────────────────────────────────────
Ghost Browser API          3000    ghost-browser-api             ✅
PostgreSQL                 5432    ghost-browser-postgres        ✅
Redis                      6379    ghost-browser-redis           ✅
pgAdmin                    5050    ghost-browser-pgadmin         ✅
```

---

## Network Communication

```
┌──────────────────────────────────────────────────┐
│  Ghost Browser Desktop App                       │
│  (connects via HTTP to shadowdesk/server:3000)  │
└──────────────────┬───────────────────────────────┘
                   │
         HTTP API Calls
                   │
                   ▼
        ┌──────────────────────────┐
        │  shadowdesk/server:3000  │
        │  ├─ Auth Endpoints       │
        │  ├─ Profile (bridges)    │
        │  ├─ Workflow (bridges)   │
        │  ├─ Detection (bridges)  │
        │  └─ Other Endpoints      │
        └──────┬───────────────────┘
               │
    HTTP Request to API Gateway
               │
               ▼
    ┌──────────────────────────────┐
    │  api-gateway:8080            │
    │  (Routes to services)        │
    └──────┬───────────────────────┘
           │
    ┌──────┴──────────────────┬────────────────┐
    │                         │                │
    ▼                         ▼                ▼
Profile Service      Automation Service   Detection Service
Port 5010            Port 5011            Port 5012
(InMemoryStore)      (InMemoryStore)      (InMemoryStore)
```

---

## Pre-Deployment Checklist

- [ ] Docker installed (`docker --version`)
- [ ] Docker Compose installed (`docker-compose --version`)
- [ ] Ports available:
  - [ ] 3000 (Ghost Browser API)
  - [ ] 5010, 5011, 5012 (Ghost Browser services)
  - [ ] 8080 (API Gateway)
  - [ ] 5432 (PostgreSQL)
  - [ ] 6379 (Redis)
  - [ ] 16686 (Jaeger)
  - [ ] 3000, 9090 (Grafana, Prometheus - different from server)
- [ ] .env files created:
  - [ ] /home/user/common-sass/.env
  - [ ] /home/user/shadowdesk/server/.env
- [ ] SSH key configured (if deploying to remote server)
- [ ] Disk space available (minimum 2GB)

---

## Deployment Steps

### 1. Start Common SaaS Stack

```bash
cd /home/user/common-sass

# Create network
docker network create common-sass

# Start services
docker-compose up -d

# Verify
docker-compose ps
docker-compose logs -f service-registry  # Wait for registration
```

**Expected logs**: Service registration messages from profile/automation/detection services

### 2. Wait for Services to Be Healthy

```bash
# Check individual service health
curl http://localhost:5010/health    # Profile Service
curl http://localhost:5011/health    # Automation Service
curl http://localhost:5012/health    # Detection Service
curl http://localhost:8080/health    # API Gateway
curl http://localhost:4000/health    # Service Registry

# Or use deployment script
/home/user/deploy.sh health
```

### 3. Start Ghost Browser Server

```bash
cd /home/user/shadowdesk/server
docker-compose up -d

# Verify
docker-compose ps
docker-compose logs -f api
```

**Expected logs**: Express server starting on port 3000

### 4. Test API Endpoints

```bash
# Health check
curl http://localhost:3000/health/live

# Register user
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "TestPass123!",
    "full_name": "Test User"
  }'

# Login
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "TestPass123!"
  }'
```

### 5. Verify Cross-Service Communication

```bash
# From shadowdesk/server container, verify it can reach common-sass
docker exec ghost-browser-api curl http://api-gateway:8080/health

# Check that api-gateway can route to profile service
curl -X GET http://localhost:8080/profiles \
  -H "Authorization: Bearer <token-from-login>"
```

---

## Troubleshooting

### Services won't start

```bash
# Check logs
docker-compose logs <service-name>

# Common issues:
# - Port already in use: Change port in docker-compose.yml
# - Database not ready: Wait longer or restart
# - Network not created: `docker network create common-sass`
```

### Services can't communicate

```bash
# Verify networks
docker network ls
docker network inspect common-sass
docker network inspect ghost-browser

# Ping between services
docker exec ghost-browser-api curl http://api-gateway:8080
docker exec common-sass-profile-service curl http://service-registry:4000
```

### Database errors

```bash
# Check PostgreSQL logs
docker-compose logs postgres

# Verify connection
docker exec common-sass-db psql -U postgres -d common_sass -c "SELECT version();"

# Check environment variables
docker exec common-sass-profile-service env | grep DATABASE
```

### Memory/Resource issues

```bash
# Check Docker resource usage
docker stats

# Increase Docker memory limit in settings:
# Mac: Docker Desktop → Preferences → Resources → Memory
# Windows: Docker Desktop → Settings → Resources → Memory
# Linux: Adjust in daemon.json
```

---

## Monitoring

### Access Dashboards

| Dashboard | URL | Credentials |
|-----------|-----|-------------|
| Grafana | http://localhost:3000 | admin / admin |
| Prometheus | http://localhost:9090 | - |
| Jaeger | http://localhost:16686 | - |
| pgAdmin | http://localhost:5050 | admin@example.com / admin |

### Useful Metrics Queries (Prometheus)

```
# CPU usage by service
rate(container_cpu_usage_seconds_total[5m])

# Memory usage
container_memory_usage_bytes

# Network I/O
rate(container_network_transmit_bytes_total[5m])
rate(container_network_receive_bytes_total[5m])

# Request latency (if instrumented)
histogram_quantile(0.95, request_duration_seconds)
```

---

## Scaling & Production Considerations

### For Production Deployment

1. **Environment Variables**: Use secrets management (Vault, AWS Secrets Manager)
2. **Database**: Switch from InMemoryStore to PostgreSQL backend
3. **SSL/TLS**: Add nginx reverse proxy with SSL termination
4. **Load Balancing**: Use Docker Swarm or Kubernetes
5. **Monitoring**: Connect to centralized monitoring (Datadog, New Relic)
6. **Backup**: Set up automated PostgreSQL backups
7. **Scaling**: Replicate containers across multiple machines

### Kubernetes Deployment (Future)

See `K8S_DEPLOYMENT.md` for Kubernetes deployment instructions.

---

## Useful Commands

```bash
# View all containers
docker ps -a

# View all images
docker images

# Clean up unused resources
docker system prune

# View logs with tail
docker-compose logs -f --tail=50 <service>

# Access container shell
docker exec -it <container-name> /bin/sh

# Rebuild specific service
docker-compose build --no-cache <service>

# Restart single service
docker-compose restart <service>

# Scale service replicas (Swarm/Compose)
docker-compose up -d --scale profile-service=3

# Remove volumes (WARNING: data loss!)
docker-compose down -v

# Export Docker logs
docker-compose logs > logs.txt

# Stop all containers
docker stop $(docker ps -q)
```

---

## Verification Checklist

After deployment, verify:

- [ ] All containers are running (`docker-compose ps`)
- [ ] Health endpoints respond (`/health` or `/health/live`)
- [ ] Databases are accessible (`psql` connection works)
- [ ] Services can reach each other (curl between containers)
- [ ] Monitoring dashboards load (Grafana, Prometheus)
- [ ] Logs are being collected (check docker-compose logs)
- [ ] Network connectivity works (cross-network requests)
- [ ] API endpoints respond (curl test)

---

## Support & Documentation

- **Setup Guide**: `DOCKER_SETUP.md`
- **Deployment Script**: `/home/user/deploy.sh`
- **Common SaaS Repo**: `/home/user/common-sass`
- **Ghost Browser Repo**: `/home/user/shadowdesk`

---

**Status**: ✅ Ready for Deployment

The Docker setup is complete and ready to deploy. Use the `deploy.sh` script for convenient management or follow `DOCKER_SETUP.md` for manual deployment.
