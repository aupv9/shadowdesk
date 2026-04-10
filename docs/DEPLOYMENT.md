# Ghost Browser Server Deployment Guide

## Overview

Ghost Browser Server can be deployed on multiple platforms:
- **Docker Compose** (local development)
- **Docker + Kubernetes** (production)
- **Cloud Run** (Google Cloud)
- **App Runner** (AWS)
- **Heroku** (legacy)

## Local Development (Docker Compose)

### Quick Start

```bash
cd server
docker-compose up
```

This starts:
- PostgreSQL (port 5432)
- Redis (port 6379)
- API server (port 3000)
- pgAdmin (port 5050)

### Database Setup

Run migrations after first startup:

```bash
docker-compose exec api npm run migrate
```

Access pgAdmin at `http://localhost:5050` to inspect database:
- Email: `admin@example.com`
- Password: `admin`

---

## Production Deployment

### Prerequisites

- PostgreSQL 14+ (managed)
- Redis 7+ (managed)
- Docker registry (Docker Hub, GitHub Container Registry, ECR, etc.)
- Container orchestration (Kubernetes, Cloud Run, App Runner)

### Environment Variables

Create a `.env.production` file with:

```bash
NODE_ENV=production
PORT=3000
HOST=0.0.0.0

# Database (use managed PostgreSQL, never local)
DATABASE_URL=postgres://user:password@prod-db.example.com:5432/ghost_browser

# Redis (use managed Redis)
REDIS_URL=redis://prod-redis.example.com:6379

# JWT (generate new key, 32+ chars minimum)
JWT_SECRET=<generate-strong-32-char-key>

# App URLs
APP_URL=https://app.ghostbrowser.app
ELECTRON_CLIENT_ORIGIN=https://app.ghostbrowser.app

# Email
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=<sendgrid-api-key>
FROM_EMAIL=noreply@ghostbrowser.app

# Optional S3 for sync bundle storage
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=<key>
AWS_SECRET_ACCESS_KEY=<secret>
S3_BUCKET=ghost-browser-prod-sync
```

### Secrets Management

**Never commit secrets to git.** Use platform-specific secret managers:

**Kubernetes:**
```yaml
# k8s/secrets.yaml
apiVersion: v1
kind: Secret
metadata:
  name: api-secrets
type: Opaque
data:
  JWT_SECRET: <base64-encoded>
  DATABASE_URL: <base64-encoded>
  REDIS_URL: <base64-encoded>
```

Apply secrets:
```bash
kubectl apply -f k8s/secrets.yaml
```

**Google Cloud Run:**
```bash
# Create secrets
gcloud secrets create JWT_SECRET --data-file=- <<< "your-jwt-secret"
gcloud secrets create DATABASE_URL --data-file=- <<< "your-db-url"
gcloud secrets create REDIS_URL --data-file=- <<< "your-redis-url"
```

**AWS Secrets Manager:**
```bash
aws secretsmanager create-secret \
  --name ghost-browser/api/jwt-secret \
  --secret-string "your-jwt-secret"
```

---

## Kubernetes Deployment

### Prerequisites

- kubectl configured
- Docker image pushed to registry

### 1. Create Namespaces & Secrets

```bash
kubectl create namespace ghost-browser-prod

# Create secrets
kubectl create secret generic api-secrets \
  --from-literal=JWT_SECRET=<secret> \
  --from-literal=DATABASE_URL=<url> \
  --from-literal=REDIS_URL=<url> \
  -n ghost-browser-prod
```

### 2. Deploy Application

Create `k8s/deployment.yaml`:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api
  namespace: ghost-browser-prod
spec:
  replicas: 3
  selector:
    matchLabels:
      app: api
  template:
    metadata:
      labels:
        app: api
    spec:
      containers:
      - name: api
        image: your-registry/ghost-browser-api:latest
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          value: "production"
        - name: PORT
          value: "3000"
        - name: HOST
          value: "0.0.0.0"
        - name: JWT_SECRET
          valueFrom:
            secretKeyRef:
              name: api-secrets
              key: JWT_SECRET
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: api-secrets
              key: DATABASE_URL
        - name: REDIS_URL
          valueFrom:
            secretKeyRef:
              name: api-secrets
              key: REDIS_URL
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health/live
            port: 3000
          initialDelaySeconds: 10
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health/ready
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: api
  namespace: ghost-browser-prod
spec:
  selector:
    app: api
  ports:
  - port: 80
    targetPort: 3000
  type: LoadBalancer
---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: api
  namespace: ghost-browser-prod
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: api
  minReplicas: 3
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
```

Deploy:

```bash
kubectl apply -f k8s/deployment.yaml
```

### 3. Database Migrations

Run migrations in a Kubernetes Job:

```yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: migrate
  namespace: ghost-browser-prod
spec:
  template:
    spec:
      containers:
      - name: migrate
        image: your-registry/ghost-browser-api:latest
        command: ["npm", "run", "migrate"]
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: api-secrets
              key: DATABASE_URL
      restartPolicy: Never
  backoffLimit: 3
```

Run:

```bash
kubectl apply -f k8s/migrate-job.yaml
```

---

## Google Cloud Run Deployment

### 1. Build & Push Image

```bash
gcloud builds submit --tag gcr.io/your-project/ghost-browser-api
```

### 2. Deploy to Cloud Run

```bash
gcloud run deploy ghost-browser-api \
  --image gcr.io/your-project/ghost-browser-api \
  --platform managed \
  --region us-central1 \
  --memory 512Mi \
  --cpu 1 \
  --min-instances 1 \
  --max-instances 100 \
  --set-env-vars NODE_ENV=production,PORT=3000 \
  --set-secrets JWT_SECRET=jwt-secret:latest,DATABASE_URL=db-url:latest,REDIS_URL=redis-url:latest
```

### 3. Set Up Cloud SQL Proxy (for PostgreSQL)

Cloud Run cannot directly access private SQL instances. Use Cloud SQL Proxy:

```bash
gcloud run deploy ghost-browser-api \
  --add-cloudsql-instances your-project:us-central1:ghost-browser-db \
  --update-secrets JWT_SECRET=jwt-secret:latest
```

---

## AWS App Runner Deployment

### 1. Create Repository

Push Docker image to ECR:

```bash
aws ecr create-repository --repository-name ghost-browser-api

# Build and push
docker build -t ghost-browser-api .
docker tag ghost-browser-api:latest \
  $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/ghost-browser-api:latest
docker push \
  $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/ghost-browser-api:latest
```

### 2. Create App Runner Service

```bash
aws apprunner create-service \
  --service-name ghost-browser-api \
  --source-configuration '{
    "ImageRepository": {
      "ImageIdentifier": "'$AWS_ACCOUNT_ID'.dkr.ecr.'$AWS_REGION'.amazonaws.com/ghost-browser-api:latest",
      "RepositoryType": "ECR"
    }
  }' \
  --auto-scaling-configuration MaxConcurrency=100,MaxSize=25,MinSize=1
```

### 3. Configure Environment Variables

```bash
aws apprunner update-service \
  --service-arn arn:aws:apprunner:... \
  --instance-configuration EnvironmentVariables='{
    "NODE_ENV":"production",
    "PORT":"8080"
  }'
```

---

## CI/CD Pipeline (GitHub Actions)

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy Ghost Browser API

on:
  push:
    branches: [main]
    paths:
      - 'server/**'

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Set up Docker Buildx
      uses: docker/setup-buildx-action@v2
    
    - name: Login to Docker Registry
      uses: docker/login-action@v2
      with:
        registry: ghcr.io
        username: ${{ github.actor }}
        password: ${{ secrets.GITHUB_TOKEN }}
    
    - name: Build and push Docker image
      uses: docker/build-push-action@v4
      with:
        context: ./server
        file: ./server/docker/Dockerfile
        push: true
        tags: ghcr.io/${{ github.repository }}/api:latest,ghcr.io/${{ github.repository }}/api:${{ github.sha }}
    
    - name: Deploy to Kubernetes
      env:
        KUBECONFIG_CONTENT: ${{ secrets.KUBECONFIG }}
      run: |
        mkdir -p $HOME/.kube
        echo "$KUBECONFIG_CONTENT" > $HOME/.kube/config
        kubectl set image deployment/api api=ghcr.io/${{ github.repository }}/api:${{ github.sha }} -n ghost-browser-prod
        kubectl rollout status deployment/api -n ghost-browser-prod
```

---

## Database Backup & Recovery

### PostgreSQL Backups (Automated)

Most managed services (Cloud SQL, RDS) provide automated backups.

Manual backup:

```bash
pg_dump postgres://user:pass@host/ghost_browser > backup.sql
```

Restore:

```bash
psql postgres://user:pass@host/ghost_browser < backup.sql
```

### Redis Snapshots

Redis backup (periodic snapshots):

```bash
SAVE
BGSAVE
```

---

## Monitoring & Alerts

### Prometheus Metrics (Future)

Metrics endpoint: `/metrics`

Deploy Prometheus:

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: prometheus-config
  namespace: ghost-browser-prod
data:
  prometheus.yml: |
    global:
      scrape_interval: 15s
    scrape_configs:
    - job_name: 'api'
      static_configs:
      - targets: ['api:3000']
```

### Application Logging

Stream logs to centralized service:

**Stackdriver (Google Cloud):**
```bash
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=ghost-browser-api" --limit 50
```

**CloudWatch (AWS):**
```bash
aws logs tail /aws/apprunner/ghost-browser-api/logs --follow
```

### Alerting

Alert on:
- High error rate (>5%)
- Slow response times (p99 > 5s)
- Database connection failures
- Token refresh failures

---

## Scaling

### Horizontal Scaling

Kubernetes automatically scales based on CPU/memory via HPA (see deployment.yaml).

Manual scaling:

```bash
kubectl scale deployment api --replicas=5 -n ghost-browser-prod
```

### Vertical Scaling

Increase resource limits in deployment:

```yaml
resources:
  limits:
    memory: "1Gi"
    cpu: "1"
```

### Database Scaling

Upgrade managed database tier if:
- Connection pool exhaustion
- Slow queries (check slow-query log)
- High transaction load

---

## Rollback

### Kubernetes Rollback

```bash
kubectl rollout history deployment/api -n ghost-browser-prod
kubectl rollout undo deployment/api -n ghost-browser-prod
```

### Database Migration Rollback

Always keep migration Down functions:

```bash
npx knex migrate:rollback
```

---

## Security Checklist

- [ ] Enable HTTPS/TLS (auto via Cloud Run, configure on K8s)
- [ ] Rotate JWT secrets annually
- [ ] Enable database encryption at rest
- [ ] Configure VPC/network policies
- [ ] Set up firewalls (restrict access)
- [ ] Enable audit logging
- [ ] Configure backups & retention
- [ ] Set up DDoS protection (WAF)
- [ ] Enable secrets encryption
- [ ] Configure CORS properly

---

## Cost Optimization

- Use **spot instances** for non-critical workloads
- Enable **auto-scaling** with reasonable limits
- Use **reserved instances** for baseline traffic
- Archive **old logs** to cold storage
- Monitor **data transfer** costs (especially S3)

---

## Troubleshooting

### Connection Refused

Check:
- Service is running: `kubectl get pods`
- Port exposed: `kubectl port-forward svc/api 3000:3000`
- Firewall rules: `gcloud compute firewall-rules list`

### Database Connection Timeout

Check:
- Connection string is correct
- Network access configured
- Connection pool not exhausted

### Memory Leak

Check:
- Node process memory: `kubectl top pods`
- Enable profiling: `NODE_OPTIONS=--inspect`

---

## Support

- Deployment issues: See `/docs/TROUBLESHOOTING.md`
- Community: GitHub Discussions
- Enterprise support: contact sales@ghostbrowser.app
