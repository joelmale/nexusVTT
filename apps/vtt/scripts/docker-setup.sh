#!/bin/bash

# Nexus VTT Docker Setup Script
# This script helps set up the Docker environment for development and production

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Functions
print_header() {
    echo -e "${BLUE}================================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}================================================${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

# Check prerequisites
check_prerequisites() {
    print_header "Checking Prerequisites"
    
    # Check Docker
    if command -v docker &> /dev/null; then
        DOCKER_VERSION=$(docker --version | cut -d ' ' -f3 | cut -d ',' -f1)
        print_success "Docker installed (version $DOCKER_VERSION)"
    else
        print_error "Docker is not installed. Please install Docker first."
        exit 1
    fi
    
    # Check Docker Compose
    if command -v docker-compose &> /dev/null; then
        COMPOSE_VERSION=$(docker-compose --version | cut -d ' ' -f4)
        print_success "Docker Compose installed (version $COMPOSE_VERSION)"
    elif docker compose version &> /dev/null; then
        COMPOSE_VERSION=$(docker compose version --short)
        print_success "Docker Compose plugin installed (version $COMPOSE_VERSION)"
    else
        print_error "Docker Compose is not installed. Please install Docker Compose first."
        exit 1
    fi
    
    # Check if Docker daemon is running
    if docker info &> /dev/null; then
        print_success "Docker daemon is running"
    else
        print_error "Docker daemon is not running. Please start Docker."
        exit 1
    fi
    
    echo ""
}

# Setup environment
setup_environment() {
    print_header "Setting up Environment"
    
    # Create .env file if it doesn't exist
    if [ ! -f .env ]; then
        cp .env.example .env
        print_success "Created .env file from .env.example"
        print_warning "Please edit .env file with your configuration"
    else
        print_success ".env file already exists"
    fi
    
    # Create necessary directories
    mkdir -p assets
    mkdir -p docker/volumes
    print_success "Created necessary directories"
    
    echo ""
}

# Build images
build_images() {
    print_header "Building Docker Images"
    
    echo "Building frontend image..."
    docker build -f docker/frontend.Dockerfile -t nexus-vtt/frontend:latest . || {
        print_error "Failed to build frontend image"
        exit 1
    }
    print_success "Frontend image built"
    
    echo "Building backend image..."
    docker build -f docker/backend.Dockerfile -t nexus-vtt/backend:latest . || {
        print_error "Failed to build backend image"
        exit 1
    }
    print_success "Backend image built"
    
    echo ""
}

# Start development environment
start_dev() {
    print_header "Starting Development Environment"
    
    docker-compose -f docker-compose.dev.yml up -d || {
        print_error "Failed to start development environment"
        exit 1
    }
    
    print_success "Development environment started"
    echo ""
    echo "Services:"
    echo "  Frontend: http://localhost:5173"
    echo "  Backend:  ws://localhost:5000"
    echo "  Redis:    localhost:6379"
    echo "  Assets:   http://localhost:8081"
    echo ""
    echo "To view logs: docker-compose -f docker-compose.dev.yml logs -f"
    echo "To stop:     docker-compose -f docker-compose.dev.yml down"
}

# Deploy to Swarm
deploy_swarm() {
    print_header "Deploying to Docker Swarm"
    
    # Check if Swarm is initialized
    if docker info | grep -q "Swarm: active"; then
        print_success "Swarm is active"
    else
        print_warning "Swarm is not initialized. Initializing now..."
        docker swarm init || {
            print_error "Failed to initialize Swarm"
            exit 1
        }
    fi
    
    # Deploy stack
    docker stack deploy -c docker-compose.yml nexus || {
        print_error "Failed to deploy stack"
        exit 1
    }
    
    print_success "Stack deployed"
    echo ""
    echo "Check status with: docker stack services nexus"
}

# Main menu
show_menu() {
    print_header "Nexus VTT Docker Setup"
    echo "1) Check prerequisites"
    echo "2) Setup environment"
    echo "3) Build Docker images"
    echo "4) Start development environment"
    echo "5) Deploy to Swarm (production)"
    echo "6) Full setup (1-4)"
    echo "0) Exit"
    echo ""
    read -p "Select option: " choice
    
    case $choice in
        1) check_prerequisites ;;
        2) setup_environment ;;
        3) build_images ;;
        4) start_dev ;;
        5) deploy_swarm ;;
        6) 
            check_prerequisites
            setup_environment
            build_images
            start_dev
            ;;
        0) exit 0 ;;
        *) 
            print_error "Invalid option"
            show_menu
            ;;
    esac
}

# Run
if [ "$1" == "--help" ] || [ "$1" == "-h" ]; then
    echo "Nexus VTT Docker Setup Script"
    echo ""
    echo "Usage: ./scripts/docker-setup.sh [option]"
    echo ""
    echo "Options:"
    echo "  --dev       Start development environment"
    echo "  --build     Build Docker images"
    echo "  --deploy    Deploy to Docker Swarm"
    echo "  --full      Run full setup"
    echo "  --help      Show this help message"
    echo ""
    echo "Without options, shows interactive menu"
elif [ "$1" == "--dev" ]; then
    start_dev
elif [ "$1" == "--build" ]; then
    build_images
elif [ "$1" == "--deploy" ]; then
    deploy_swarm
elif [ "$1" == "--full" ]; then
    check_prerequisites
    setup_environment
    build_images
    start_dev
else
    show_menu
fi
