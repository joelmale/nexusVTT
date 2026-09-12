# Database Schema

## Overview

NexusCodex uses PostgreSQL as the primary database with Prisma ORM for type-safe database operations. The schema is designed to support document management, user authentication, real-time collaboration, and structured data extraction.

## Core Tables

### Document
**Primary table for document metadata and storage information.**

```sql
CREATE TABLE documents (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  type document_type NOT NULL,
  format document_format NOT NULL,

  -- Storage
  storage_key TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  page_count INTEGER DEFAULT 0,
  thumbnail_key TEXT,

  -- Metadata
  author TEXT DEFAULT '',
  uploaded_by TEXT NOT NULL,        -- VTT user ID
  uploaded_by_id TEXT REFERENCES users(id),
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  last_modified TIMESTAMPTZ DEFAULT NOW(),

  -- Organization
  tags TEXT[] DEFAULT '{}',
  collections TEXT[] DEFAULT '{}',
  campaigns TEXT[] DEFAULT '{}',

  -- Search & Processing
  search_index TEXT,                -- ElasticSearch ID
  content_hash TEXT,                -- SHA-256 for deduplication
  ocr_status ocr_status DEFAULT 'not_required',

  -- Access
  is_public BOOLEAN DEFAULT FALSE,
  metadata JSONB DEFAULT '{}'
);
```

**Key Fields:**
- `storage_key`: S3 object key for the file
- `content_hash`: SHA-256 hash for duplicate detection
- `tags`: Array of tag strings for categorization
- `campaigns`: Array of campaign IDs for organization

**Indexes:**
- `uploaded_by` (user who uploaded)
- `type` (document type)
- `campaigns` (GIN index for array operations)
- `tags` (GIN index for array operations)
- `content_hash` (for duplicate detection)

### User
**User accounts and authentication data.**

```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role user_role DEFAULT 'user',
  is_active BOOLEAN DEFAULT TRUE,

  -- Profile
  display_name TEXT,
  avatar_url TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_login_at TIMESTAMPTZ
);
```

**Key Fields:**
- `password_hash`: Bcrypt-hashed password
- `role`: User role (admin/user)
- `is_active`: Account status flag

### DocumentReference
**Bookmarks and document references for quick access.**

```sql
CREATE TABLE document_references (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  campaign_id TEXT,

  -- Location within document
  page_number INTEGER,
  section TEXT,
  text_selection JSONB,  -- {start, end, text}

  -- Reference metadata
  title TEXT NOT NULL,
  notes TEXT,
  tags TEXT[] DEFAULT '{}',
  color TEXT,
  is_shared BOOLEAN DEFAULT FALSE,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_accessed TIMESTAMPTZ
);
```

**Purpose:** Allows users to bookmark specific pages or sections of documents for quick access during gameplay.

### DocumentAnnotation
**User annotations on documents (highlights, notes, drawings).**

```sql
CREATE TABLE document_annotations (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  reference_id TEXT REFERENCES document_references(id) ON DELETE SET NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  campaign_id TEXT,

  -- Location on page
  page_number INTEGER NOT NULL,
  position JSONB NOT NULL,  -- {x, y, width?, height?}

  -- Annotation details
  type annotation_type NOT NULL,
  content TEXT NOT NULL,    -- Note text or drawing data
  color TEXT DEFAULT '#FFFF00',

  is_shared BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  modified_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Annotation Types:**
- `highlight`: Text highlighting
- `note`: Text notes
- `drawing`: Free-form drawings

### StructuredData
**Extracted D&D content (spells, monsters, items, etc.).**

```sql
CREATE TABLE structured_data (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  type structured_data_type NOT NULL,

  -- Location in document
  page_number INTEGER,
  section TEXT,

  -- Structured content
  name TEXT NOT NULL,       -- Spell name, item name, etc.
  data JSONB NOT NULL,      -- Full structured data
  search_text TEXT NOT NULL, -- Flattened text for search

  -- Search
  search_index TEXT,        -- ElasticSearch document ID

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Structured Data Types:**
- `spell`: D&D spells with level, school, components, etc.
- `item`: Magic items, equipment
- `monster`: Creature stat blocks
- `feat`: Character feats
- `class_feature`: Class abilities
- `other`: Miscellaneous structured content

### TagMetadata
**Metadata for document tags (categories, colors, descriptions).**

```sql
CREATE TABLE tag_metadata (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,  -- Must match tags used in documents
  category TEXT,              -- e.g., "content", "campaign", "system"
  color TEXT,                 -- Hex color for UI (e.g., "#FF5733")
  description TEXT,           -- Tag purpose description
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Purpose:** Provides additional metadata for tags used in the `documents.tags` array.

## Enums

### DocumentType
```sql
CREATE TYPE document_type AS ENUM (
  'rulebook',
  'campaign_note',
  'handout',
  'map',
  'character_sheet',
  'homebrew'
);
```

### DocumentFormat
```sql
CREATE TYPE document_format AS ENUM (
  'pdf',
  'markdown',
  'html'
);
```

### OcrStatus
```sql
CREATE TYPE ocr_status AS ENUM (
  'pending',
  'processing',
  'completed',
  'failed',
  'not_required'
);
```

### AnnotationType
```sql
CREATE TYPE annotation_type AS ENUM (
  'highlight',
  'note',
  'drawing'
);
```

### StructuredDataType
```sql
CREATE TYPE structured_data_type AS ENUM (
  'spell',
  'item',
  'monster',
  'feat',
  'class_feature',
  'other'
);
```

### UserRole
```sql
CREATE TYPE user_role AS ENUM (
  'admin',
  'user'
);
```

## Relationships

```
User (1) ──── (M) Document
   │              │
   │              │
   └──── (M) ────┼── DocumentReference (M) ─── (1) DocumentAnnotation
                  │
                  │
                  └──── (M) StructuredData
```

## Indexes

### Performance Indexes
```sql
-- Document queries
CREATE INDEX idx_documents_uploaded_by ON documents(uploaded_by);
CREATE INDEX idx_documents_type ON documents(type);
CREATE INDEX idx_documents_campaigns ON documents USING GIN(campaigns);
CREATE INDEX idx_documents_tags ON documents USING GIN(tags);
CREATE INDEX idx_documents_content_hash ON documents(content_hash);

-- User queries
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);

-- Reference queries
CREATE INDEX idx_document_references_document_id ON document_references(document_id);
CREATE INDEX idx_document_references_user_id ON document_references(user_id);
CREATE INDEX idx_document_references_campaign_id ON document_references(campaign_id);

-- Annotation queries
CREATE INDEX idx_document_annotations_document_id ON document_annotations(document_id);
CREATE INDEX idx_document_annotations_user_id ON document_annotations(user_id);
CREATE INDEX idx_document_annotations_campaign_id ON document_annotations(campaign_id);
CREATE INDEX idx_document_annotations_page_number ON document_annotations(page_number);

-- Structured data queries
CREATE INDEX idx_structured_data_document_id ON structured_data(document_id);
CREATE INDEX idx_structured_data_type ON structured_data(type);
CREATE INDEX idx_structured_data_name ON structured_data(name);

-- Tag metadata
CREATE INDEX idx_tag_metadata_category ON tag_metadata(category);
```

## Data Flow

### Document Upload
1. **Metadata Creation**: Document record created with `status = 'pending'`
2. **File Upload**: File uploaded to S3 with pre-signed URL
3. **Processing**: Background job extracts text, generates thumbnail
4. **Indexing**: Content indexed in ElasticSearch
5. **Completion**: Document marked as `completed`

### Search Operations
1. **Query**: Search term sent to ElasticSearch
2. **Results**: Document IDs returned with relevance scores
3. **Enrichment**: PostgreSQL queried for full metadata
4. **Response**: Combined results with highlights

### Real-time Collaboration
1. **Session Creation**: Redis stores session metadata
2. **Page Sync**: WebSocket broadcasts page changes
3. **Annotations**: Real-time annotation updates
4. **Persistence**: Changes saved to PostgreSQL

## Migration Strategy

### Development
```bash
cd services/doc-api
npm run prisma:migrate dev
```

### Production
```bash
cd services/doc-api
npm run prisma:migrate deploy
```

## Backup Strategy

### Database Backup
```bash
pg_dump -U user -h localhost doclib > backup.sql
```

### Document Files
- S3 bucket versioning enabled
- Cross-region replication for disaster recovery
- Regular backup snapshots

### Search Indexes
- ElasticSearch snapshots to S3
- Index recreation capability from PostgreSQL data

## Performance Considerations

### Query Optimization
- Use `EXPLAIN ANALYZE` for complex queries
- Consider partial indexes for common filters
- Monitor slow query logs

### Connection Pooling
- Prisma handles connection pooling automatically
- Configure pool size based on load

### Caching Strategy
- Redis for session data and temporary caches
- Application-level caching for frequently accessed data
- CDN for static assets (thumbnails, etc.)

## Monitoring

### Key Metrics
- Query performance (slow queries)
- Connection pool utilization
- Index usage and bloat
- Table sizes and growth

### Health Checks
- Database connectivity
- ElasticSearch cluster status
- Redis availability
- S3 bucket access