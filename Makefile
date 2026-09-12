# Makefile for Nexus VTT Docker operations

.PHONY: help dev dev-logs dev-stop dev-rebuild build test test-unit test-integration clean health-check

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
	@echo "  Production targets are intentionally unavailable until Phase 3 is complete."
	@echo "  Do not use apps/vtt/docker/docker-compose.yml with Dockhand or Swarm."
	@echo ""
	@echo "Utilities:"
	@echo "  make clean        - Clean up local development volumes and images"
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

# Local image build (not a production deploy)
build:
	docker build -f apps/vtt/docker/frontend.Dockerfile -t nexus-vtt/frontend:latest apps/vtt
	docker build -f apps/vtt/docker/backend.Dockerfile -t nexus-vtt/backend:latest apps/vtt

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
	docker system prune -af

# Health checks
health-check:
	@curl -f http://localhost/health || echo "Frontend unhealthy"
	@curl -f http://localhost:5000/health || echo "Backend unhealthy"
