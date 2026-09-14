# Directory Structure

## Root Level

```
nexus-codex/
├── dev_docs/              # Developer documentation (this directory)
├── services/              # Microservices
├── docker-compose.yml     # Development orchestration
├── docker-compose.test.yml # Testing environment
├── test-stack.sh         # Health check script
├── run-tests.sh          # Test runner
├── CLAUDE.md             # AI assistant guidance
├── README.md             # Project overview
├── LICENSE               # MIT License
└── .gitignore            # Git ignore rules
```

## Services Directory

### services/admin-ui/
**React-based Administration Interface**

```
admin-ui/
├── public/                # Static assets
│   ├── vite.svg
│   └── react.svg
├── src/
│   ├── assets/           # Images and icons
│   ├── components/       # React components
│   │   ├── ui/          # shadcn/ui components
│   │   └── Layout.tsx   # Main layout
│   ├── contexts/        # React contexts
│   │   └── AuthContext.tsx
│   ├── lib/             # Utilities
│   │   └── utils.ts
│   ├── pages/           # Route pages
│   │   ├── Dashboard.tsx
│   │   ├── Login.tsx
│   │   ├── Documents.tsx
│   │   ├── Processing.tsx
│   │   ├── Search.tsx
│   │   ├── DataQuality.tsx
│   │   ├── Deduplication.tsx
│   │   ├── ElasticSearch.tsx
│   │   ├── Health.tsx
│   │   ├── BulkUpload.tsx
│   │   └── Documents.tsx
│   ├── App.css
│   ├── App.tsx          # Main app component
│   ├── index.css        # Global styles
│   └── main.tsx         # Entry point
├── components.json      # shadcn/ui config
├── package.json
├── tailwind.config.js   # TailwindCSS config
├── tsconfig.json        # TypeScript config
├── vite.config.ts       # Vite config
├── eslint.config.js     # ESLint config
├── postcss.config.js    # PostCSS config
└── nginx.conf           # Production nginx config
```

### services/doc-api/
**Fastify-based REST API Service**

```
doc-api/
├── prisma/              # Database schema and migrations
│   └── schema.prisma
├── src/
│   ├── config/         # Configuration
│   │   └── env.ts
│   ├── routes/         # API route handlers
│   │   ├── admin/      # Admin-only endpoints
│   │   │   ├── documents.ts    # Document management
│   │   │   ├── queue.ts        # Queue management
│   │   │   ├── search.ts       # Advanced search
│   │   │   ├── duplicates.ts   # Deduplication
│   │   │   ├── tags.ts         # Tag management
│   │   │   ├── validation.ts   # Data quality
│   │   │   ├── users.ts        # User management
│   │   │   ├── elasticsearch.ts # Search index mgmt
│   │   │   └── health.ts       # System health
│   │   ├── auth.ts             # Authentication
│   │   ├── documents.ts        # Document CRUD
│   │   ├── processing.ts       # Processing status
│   │   ├── search.ts           # Search operations
│   │   ├── references.ts       # Bookmarks/annotations
│   │   ├── annotations.ts      # Document annotations
│   │   └── structured-data.ts  # D&D content
│   ├── services/       # Business logic
│   │   ├── auth.service.ts     # User auth
│   │   ├── database.service.ts # DB operations
│   │   ├── s3.service.ts       # File storage
│   │   ├── elastic.service.ts  # Search operations
│   │   ├── queue.service.ts    # Job queuing
│   │   ├── health.service.ts   # System monitoring
│   │   ├── metrics.service.ts  # Performance metrics
│   │   ├── alerts.service.ts   # Alert system
│   │   ├── content-hash.service.ts # Duplicate detection
│   │   ├── logging.service.ts  # Job logging
│   │   ├── elasticsearch-management.service.ts
│   │   ├── file-preview.service.ts
│   │   └── validation.service.ts
│   ├── types/          # TypeScript type definitions
│   │   ├── admin.ts    # Admin API types
│   │   ├── document.ts # Document types
│   │   ├── search.ts   # Search types
│   │   ├── annotation.ts
│   │   ├── reference.ts
│   │   └── structured-data.ts
│   ├── scripts/        # Utility scripts
│   │   └── create-admin.ts
│   ├── __tests__/      # Unit tests
│   │   ├── documents.integration.test.ts
│   │   └── structured-data.integration.test.ts
│   └── server.ts       # Fastify app setup
├── package.json
├── tsconfig.json
├── jest.config.js      # Test configuration
└── .env.example        # Environment template
```

### services/doc-processor/
**Background Document Processing Worker**

```
doc-processor/
├── prisma/             # Symlink to doc-api schema
│   └── schema.prisma
├── src/
│   ├── config/
│   │   └── env.ts
│   ├── services/       # Processing services
│   │   ├── extraction.service.ts    # D&D content extraction
│   │   ├── pdf.service.ts           # PDF processing
│   │   ├── markdown.service.ts      # Markdown processing
│   │   ├── ocr.service.ts           # OCR processing
│   │   ├── thumbnail.service.ts     # Image thumbnails
│   │   ├── content-hash.service.ts  # File hashing
│   │   ├── elastic.service.ts       # Search indexing
│   │   ├── database.service.ts      # DB operations
│   │   ├── logging.service.ts       # Processing logs
│   │   ├── queue.service.ts         # Job management
│   │   └── s3.service.ts            # File operations
│   ├── types/          # Type definitions
│   │   └── pdfjs-dist.d.ts
│   ├── workers/        # BullMQ job handlers
│   │   └── process-document.worker.ts
│   └── __tests__/      # Unit tests
│       ├── extraction.service.test.ts
│       ├── markdown.service.test.ts
│       └── ocr.service.test.ts
├── package.json
├── tsconfig.json
├── jest.config.js
└── .env.example
```

### services/doc-websocket/
**Real-time Collaboration Server**

```
doc-websocket/
├── prisma/             # Symlink to doc-api schema
│   └── schema.prisma
├── src/
│   ├── config/
│   │   └── env.ts
│   ├── handlers/       # WebSocket event handlers
│   │   ├── session.handler.ts      # Session management
│   │   ├── navigation.handler.ts   # Page navigation
│   │   ├── annotation.handler.ts   # Real-time annotations
│   │   └── push.handler.ts         # DM push features
│   ├── services/       # Business logic
│   │   ├── database.service.ts     # DB operations
│   │   ├── redis.service.ts        # Session storage
│   │   └── session.service.ts      # Session management
│   ├── types/          # Type definitions
│   │   ├── events.ts   # WebSocket events
│   │   └── session.ts  # Session types
│   ├── websocket/      # WebSocket server
│   │   └── server.ts
│   └── __tests__/      # Unit tests
├── package.json
├── tsconfig.json
├── jest.config.js
└── .env.example
```

## Key Files Reference

### Configuration Files

| File | Purpose | Location |
|------|---------|----------|
| `docker-compose.yml` | Development services | Root |
| `docker-compose.test.yml` | Testing environment | Root |
| `package.json` | Dependencies and scripts | Each service |
| `tsconfig.json` | TypeScript configuration | Each service |
| `prisma/schema.prisma` | Database schema | doc-api/prisma/ |
| `.env.example` | Environment variables template | Each service |

### Core Application Files

| File | Purpose | Service |
|------|---------|---------|
| `server.ts` | Fastify app setup and routes | doc-api |
| `process-document.worker.ts` | Document processing pipeline | doc-processor |
| `server.ts` | WebSocket server setup | doc-websocket |
| `App.tsx` | React app component | admin-ui |
| `main.tsx` | React entry point | admin-ui |

### Service Files

| Pattern | Purpose |
|---------|---------|
| `routes/*.ts` | API endpoint handlers |
| `services/*.service.ts` | Business logic |
| `types/*.ts` | TypeScript definitions |
| `workers/*.worker.ts` | Background job processors |
| `__tests__/*.test.ts` | Unit and integration tests |

## File Naming Conventions

- **Routes**: `resource.ts` (e.g., `documents.ts`, `auth.ts`)
- **Services**: `feature.service.ts` (e.g., `auth.service.ts`)
- **Types**: `domain.ts` (e.g., `document.ts`, `search.ts`)
- **Tests**: `feature.test.ts` or `feature.integration.test.ts`
- **Workers**: `task.worker.ts` (e.g., `process-document.worker.ts`)

## Import Patterns

### Relative Imports
```typescript
// Same directory
import { UserService } from './user.service';

// Parent directory
import { DatabaseService } from '../services/database.service';

// Sibling directory
import { DocumentTypes } from '../types/document';
```

### External Dependencies
```typescript
// Node modules
import { FastifyInstance } from 'fastify';
import { z } from 'zod';

// Local services
import { AuthService } from '../../services/auth.service';
```

## Environment Configuration

Each service has its own `.env` file with service-specific configuration:

- **doc-api**: Database, Redis, ElasticSearch, S3, JWT secrets
- **doc-processor**: Same as doc-api (shared infrastructure)
- **doc-websocket**: Database, Redis, session settings
- **admin-ui**: API endpoint URL, development settings