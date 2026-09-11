# Makefile for Nexus VTT Docker operations

.PHONY: help build up down logs shell test deploy clean

# Default target
help:
	@echo "Nexus VTT Docker Management"
	@echo "=========================="
	@echo "Development:"
	@echo "  make dev          - Start development environment"
	@echo "  make dev-logs     - View development logs"
	@echo "  make dev-stop     - Stop development environment"
	@echo ""
	@echo "Production:"
	@echo "  make build        - Build all Docker images"
	@echo "  make deploy       - Deploy to Docker Swarm"
	@echo "  make stack-rm     - Remove from Docker Swarm"
	@echo ""
	@echo "Utilities:"
	@echo "  make logs         - View logs (production)"
	@echo "  make shell-front  - Shell into frontend container"
	@echo "  make shell-back   - Shell into backend container"
	@echo "  make clean        - Clean up volumes and images"
	@echo "  make test         - Run tests in containers"

# Development targets
dev:
	docker-compose -f apps/vtt/docker/docker-compose.dev.yml up

dev-logs:
	docker-compose -f apps/vtt/docker/docker-compose.dev.yml logs -f

dev-stop:
	docker-compose -f apps/vtt/docker/docker-compose.dev.yml down

dev-rebuild:
	docker-compose -f apps/vtt/docker/docker-compose.dev.yml up --build

# Production build
build:
	docker build -f apps/vtt/docker/frontend.Dockerfile -t nexus-vtt/frontend:latest apps/vtt
	docker build -f apps/vtt/docker/backend.Dockerfile -t nexus-vtt/backend:latest apps/vtt

build-push: build
	docker push nexus-vtt/frontend:latest
	docker push nexus-vtt/backend:latest

# Production deployment
deploy:
	docker stack deploy -c apps/vtt/docker/docker-compose.yml nexus

stack-rm:
	docker stack rm nexus

stack-ps:
	docker stack ps nexus

stack-services:
	docker stack services nexus

# Utility targets
logs:
	docker service logs -f nexus_backend

logs-front:
	docker service logs -f nexus_frontend

shell-front:
	docker exec -it $$(docker ps -q -f name=nexus_frontend) sh

shell-back:
	docker exec -it $$(docker ps -q -f name=nexus_backend) sh

# Testing
test:
	docker-compose -f apps/vtt/docker/docker-compose.test.yml run --rm test

test-unit:
	docker-compose -f apps/vtt/docker/docker-compose.test.yml run --rm test npm run test:unit

test-integration:
	docker-compose -f apps/vtt/docker/docker-compose.test.yml run --rm test npm run test:integration

# Cleanup
clean:
	docker-compose -f apps/vtt/docker/docker-compose.dev.yml down -v
	docker system prune -f

clean-all:
	docker-compose -f apps/vtt/docker/docker-compose.dev.yml down -v
	docker stack rm nexus
	docker system prune -af

# Health checks
health-check:
	@curl -f http://localhost/health || echo "Frontend unhealthy"
	@curl -f http://localhost:5000/health || echo "Backend unhealthy"
