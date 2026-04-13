#!/bin/bash

# Ghost Browser + Common SaaS Deployment Script
# Provides convenient commands for managing Docker services

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Paths
COMMON_SASS_DIR="/home/user/common-sass"
SHADOWDESK_DIR="/home/user/shadowdesk/server"

# Functions
print_header() {
  echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
  echo -e "${BLUE}$1${NC}"
  echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
}

print_success() {
  echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
  echo -e "${RED}✗ $1${NC}"
}

print_warning() {
  echo -e "${YELLOW}⚠ $1${NC}"
}

print_info() {
  echo -e "${BLUE}→ $1${NC}"
}

start_common_sass() {
  print_header "Starting Common SaaS Stack"
  cd "$COMMON_SASS_DIR"

  print_info "Creating network..."
  docker network create common-sass 2>/dev/null || true

  print_info "Starting services..."
  docker-compose up -d

  print_success "Common SaaS stack started"
  echo ""
  echo "Services:"
  echo "  API Gateway:        http://localhost:8080"
  echo "  Profile Service:    http://localhost:5010"
  echo "  Automation Service: http://localhost:5011"
  echo "  Detection Service:  http://localhost:5012"
  echo "  Service Registry:   http://localhost:4000"
  echo "  Grafana:            http://localhost:3000 (admin/admin)"
  echo "  Jaeger:             http://localhost:16686"
  echo "  Prometheus:         http://localhost:9090"
  echo ""
}

start_shadowdesk() {
  print_header "Starting Ghost Browser Server"
  cd "$SHADOWDESK_DIR"

  print_info "Starting services..."
  docker-compose up -d

  print_success "Ghost Browser server started"
  echo ""
  echo "Services:"
  echo "  API Server: http://localhost:3000"
  echo "  pgAdmin:    http://localhost:5050 (admin@example.com/admin)"
  echo ""
}

start_all() {
  print_header "Starting All Services"
  start_common_sass
  sleep 5
  start_shadowdesk
  print_success "All services started!"
  print_info "Waiting for services to be healthy..."
  sleep 10
  check_health
}

stop_common_sass() {
  print_header "Stopping Common SaaS Stack"
  cd "$COMMON_SASS_DIR"
  docker-compose down
  print_success "Common SaaS stack stopped"
}

stop_shadowdesk() {
  print_header "Stopping Ghost Browser Server"
  cd "$SHADOWDESK_DIR"
  docker-compose down
  print_success "Ghost Browser server stopped"
}

stop_all() {
  print_header "Stopping All Services"
  stop_common_sass
  stop_shadowdesk
  print_success "All services stopped!"
}

restart_all() {
  stop_all
  sleep 2
  start_all
}

check_health() {
  print_header "Health Check"

  local services=(
    "API Gateway:http://localhost:8080/health"
    "Ghost Browser API:http://localhost:3000/health/live"
    "Profile Service:http://localhost:5010/health"
    "Automation Service:http://localhost:5011/health"
    "Detection Service:http://localhost:5012/health"
  )

  for service in "${services[@]}"; do
    IFS=":" read -r name url <<< "$service"
    if curl -s "$url" > /dev/null 2>&1; then
      print_success "$name is healthy"
    else
      print_warning "$name is not responding (may still be starting)"
    fi
  done
  echo ""
}

logs_all() {
  print_header "Logs (All Services)"
  docker-compose -f "$COMMON_SASS_DIR/docker-compose.yml" \
                  -f "$SHADOWDESK_DIR/docker-compose.yml" \
                  logs -f --tail=50
}

logs_common_sass() {
  print_header "Logs (Common SaaS)"
  docker-compose -f "$COMMON_SASS_DIR/docker-compose.yml" logs -f --tail=50
}

logs_shadowdesk() {
  print_header "Logs (Ghost Browser Server)"
  docker-compose -f "$SHADOWDESK_DIR/docker-compose.yml" logs -f --tail=50
}

status() {
  print_header "Service Status"

  print_info "Common SaaS Services:"
  cd "$COMMON_SASS_DIR"
  docker-compose ps
  echo ""

  print_info "Ghost Browser Server:"
  cd "$SHADOWDESK_DIR"
  docker-compose ps
  echo ""
}

reset() {
  print_header "Resetting All Services"
  print_warning "This will delete all data!"
  read -p "Are you sure? (y/n) " -n 1 -r
  echo
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    stop_all
    print_info "Removing volumes..."
    cd "$COMMON_SASS_DIR"
    docker-compose down -v
    cd "$SHADOWDESK_DIR"
    docker-compose down -v
    print_success "All services and data removed"
  else
    print_info "Reset cancelled"
  fi
}

show_usage() {
  cat << EOF
Usage: $0 <command>

Commands:
  start-all       Start all services (common-sass + shadowdesk)
  stop-all        Stop all services
  restart-all     Restart all services

  start-cs        Start common-sass services only
  stop-cs         Stop common-sass services only
  start-sb        Start shadowdesk server only
  stop-sb         Stop shadowdesk server only

  status          Show service status
  health          Check service health

  logs            Show logs from all services
  logs-cs         Show logs from common-sass
  logs-sb         Show logs from shadowdesk

  reset           Reset all services (delete data)

  help            Show this message

Examples:
  $0 start-all      # Start everything
  $0 logs -f        # View logs in real-time
  $0 health         # Check if services are healthy
  $0 restart-all    # Restart all services

EOF
}

# Main
case "${1:-help}" in
  start-all)
    start_all
    ;;
  stop-all)
    stop_all
    ;;
  restart-all)
    restart_all
    ;;
  start-cs)
    start_common_sass
    ;;
  stop-cs)
    stop_common_sass
    ;;
  start-sb)
    start_shadowdesk
    ;;
  stop-sb)
    stop_shadowdesk
    ;;
  status)
    status
    ;;
  health)
    check_health
    ;;
  logs)
    logs_all
    ;;
  logs-cs)
    logs_common_sass
    ;;
  logs-sb)
    logs_shadowdesk
    ;;
  reset)
    reset
    ;;
  help|--help|-h)
    show_usage
    ;;
  *)
    print_error "Unknown command: $1"
    echo ""
    show_usage
    exit 1
    ;;
esac
