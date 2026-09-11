# NexusCodex Developer Documentation

Welcome to the comprehensive developer documentation for NexusCodex, a document library microservice system for Virtual Tabletop (VTT) applications.

## Overview

NexusCodex is a distributed document management system designed specifically for D&D and other tabletop gaming content. It provides document upload, processing, search, real-time collaboration, and structured data extraction capabilities.

### Key Features

- **Document Management**: Upload, process, and organize documents
- **Real-time Collaboration**: WebSocket-based synchronized document viewing
- **Advanced Search**: Full-text search with ElasticSearch
- **Structured Data Extraction**: Automatic parsing of D&D content (spells, monsters, items)
- **Admin Interface**: React-based dashboard for system management
- **Scalable Architecture**: Microservices design with Docker orchestration

### Architecture

The system consists of four main microservices:

1. **doc-api**: Fastify-based REST API for document operations
2. **doc-processor**: Background document processing worker
3. **doc-websocket**: Real-time collaboration server
4. **admin-ui**: React-based administration interface

### Technology Stack

- **Backend**: Node.js, TypeScript, Fastify
- **Database**: PostgreSQL with Prisma ORM
- **Search**: ElasticSearch
- **Queue**: Redis with BullMQ
- **Storage**: S3-compatible storage (MinIO for dev, GCS/S3 for prod)
- **Frontend**: React, Vite, TailwindCSS, shadcn/ui

## Quick Start

```bash
# Clone and setup
git clone <repository>
cd nexus-codex

# Start all services
docker compose up --build

# Access interfaces
# Admin UI: http://localhost:3001
# API Docs: http://localhost:3000
# MinIO Console: http://localhost:9001
```

## Documentation Structure

- [Architecture Overview](architecture.md) - System design and data flow
- [Directory Structure](directory-structure.md) - Codebase organization
- [API Reference](api-reference.md) - REST API endpoints
- [Database Schema](database-schema.md) - Data models and relationships
- [WebSocket Events](websocket-events.md) - Real-time communication
- [Development Setup](development-setup.md) - Local development environment
- [Deployment Guide](deployment.md) - Production deployment
- [Configuration](configuration.md) - Environment variables and settings

## Contributing

See [Development Setup](development-setup.md) for local development instructions.

## License

MIT License