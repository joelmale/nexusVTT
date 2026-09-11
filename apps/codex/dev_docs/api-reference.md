# API Reference

## Base URL
```
http://localhost:3000
```

## Authentication

All API requests require authentication except for registration and login. Include the JWT token in the Authorization header:

```
Authorization: Bearer <access_token>
```

## Response Format

All responses follow this structure:

```json
{
  "data": { /* response data */ },
  "error": "error message (if any)",
  "meta": { /* pagination/metadata */ }
}
```

---

## Authentication Endpoints

### POST /auth/register
Register a new user account.

**Request Body:**
```json
{
  "username": "string (3-50 chars)",
  "email": "string (valid email)",
  "password": "string (min 8 chars)",
  "displayName": "string (optional)"
}
```

**Response:**
```json
{
  "user": {
    "id": "string",
    "username": "string",
    "email": "string",
    "role": "user",
    "displayName": "string",
    "createdAt": "string"
  },
  "tokens": {
    "accessToken": "string",
    "refreshToken": "string"
  }
}
```

### POST /auth/login
Authenticate user and get tokens.

**Request Body:**
```json
{
  "username": "string",
  "password": "string"
}
```

**Response:** Same as registration

### POST /auth/refresh
Refresh access token using refresh token.

**Request Body:**
```json
{
  "refreshToken": "string"
}
```

**Response:**
```json
{
  "accessToken": "string",
  "refreshToken": "string"
}
```

### GET /auth/me
Get current user profile.

**Headers:** Authorization required

**Response:**
```json
{
  "id": "string",
  "username": "string",
  "email": "string",
  "role": "admin|user",
  "isActive": true,
  "displayName": "string",
  "avatarUrl": "string",
  "createdAt": "string",
  "updatedAt": "string",
  "lastLoginAt": "string"
}
```

---

## Document Management

### GET /api/documents
List documents with filtering and pagination.

**Query Parameters:**
- `skip`: number (default: 0)
- `take`: number (default: 20, max: 100)
- `search`: string (title/content search)
- `type`: string (document type filter)
- `status`: string (processing status)
- `uploadedBy`: string (user ID)
- `campaign`: string
- `tags`: string[] (tag IDs)

**Response:**
```json
{
  "documents": [
    {
      "id": "string",
      "title": "string",
      "type": "string",
      "status": "pending|processing|completed|failed",
      "fileSize": "number",
      "uploadedBy": "string",
      "uploadedAt": "string",
      "tags": ["string"],
      "campaign": "string"
    }
  ],
  "total": 150,
  "skip": 0,
  "take": 20
}
```

### POST /api/documents
Create a new document (metadata only).

**Request Body:**
```json
{
  "title": "string",
  "type": "pdf|markdown|image",
  "campaign": "string (optional)",
  "tags": ["string"] (optional)
}
```

**Response:**
```json
{
  "document": {
    "id": "string",
    "title": "string",
    "uploadUrl": "string (pre-signed S3 URL)",
    "status": "pending"
  }
}
```

### GET /api/documents/:id
Get document details.

**Response:**
```json
{
  "id": "string",
  "title": "string",
  "type": "string",
  "status": "string",
  "fileSize": "number",
  "contentHash": "string",
  "uploadedBy": "string",
  "uploadedAt": "string",
  "processedAt": "string",
  "tags": ["string"],
  "campaign": "string",
  "thumbnailUrl": "string",
  "previewUrl": "string"
}
```

### PATCH /api/documents/:id
Update document metadata.

**Request Body:**
```json
{
  "title": "string",
  "campaign": "string",
  "tags": ["string"]
}
```

### DELETE /api/documents/:id
Delete document and associated files.

### GET /api/documents/:id/content
Get document file content (with Range header support for PDFs).

**Headers:**
```
Range: bytes=0-1023 (optional)
```

**Response:** File content with appropriate Content-Type

### POST /api/documents/:id/process
Trigger document processing.

---

## Search Endpoints

### GET /api/search
Basic search across documents.

**Query Parameters:**
- `q`: string (search query)
- `type`: string (document type)
- `limit`: number (default: 20)

**Response:**
```json
{
  "results": [
    {
      "id": "string",
      "title": "string",
      "type": "string",
      "score": 0.95,
      "highlights": ["string"],
      "tags": ["string"]
    }
  ],
  "total": 25
}
```

### GET /api/search/quick
Quick search with type filtering.

**Query Parameters:**
- `term`: string
- `type`: "spell|monster|item" (optional)

**Response:** Same as basic search

### POST /api/search/advanced
Advanced search with faceted filtering.

**Request Body:**
```json
{
  "query": "string",
  "filters": {
    "type": ["pdf"],
    "tags": ["combat"],
    "uploadedBy": "user-id",
    "dateRange": {
      "start": "2024-01-01",
      "end": "2024-12-31"
    },
    "fileSize": {
      "min": 1000,
      "max": 1000000
    }
  },
  "sort": {
    "field": "uploadedAt",
    "order": "desc"
  },
  "pagination": {
    "skip": 0,
    "take": 20
  }
}
```

---

## Structured Data

### GET /api/structured-data
List extracted D&D content.

**Query Parameters:**
- `type`: "spell|monster|item"
- `search`: string
- `skip`: number
- `take`: number

**Response:**
```json
{
  "data": [
    {
      "id": "string",
      "documentId": "string",
      "type": "spell",
      "data": {
        "name": "Fireball",
        "level": 3,
        "school": "evocation",
        "castingTime": "1 action",
        "range": "150 feet",
        "components": "V, S, M",
        "duration": "Instantaneous",
        "description": "string"
      }
    }
  ],
  "total": 150
}
```

### GET /api/structured-data/:id
Get specific structured data item.

---

## References & Annotations

### GET /api/references
List document references (bookmarks).

**Query Parameters:**
- `documentId`: string
- `userId`: string
- `campaignId`: string

**Response:**
```json
{
  "references": [
    {
      "id": "string",
      "documentId": "string",
      "userId": "string",
      "page": 5,
      "x": 100,
      "y": 200,
      "note": "string",
      "createdAt": "string"
    }
  ]
}
```

### POST /api/references
Create a document reference.

**Request Body:**
```json
{
  "documentId": "string",
  "page": 1,
  "x": 100,
  "y": 200,
  "note": "string (optional)"
}
```

### GET /api/annotations
List document annotations.

**Query Parameters:**
- `documentId`: string
- `userId`: string

### POST /api/annotations
Create an annotation.

**Request Body:**
```json
{
  "documentId": "string",
  "page": 1,
  "type": "highlight|note|drawing",
  "data": {
    "x": 100,
    "y": 200,
    "width": 50,
    "height": 20,
    "color": "#ffff00",
    "content": "string"
  }
}
```

---

## Admin Endpoints

### Document Management

#### GET /api/admin/documents
Enhanced document listing with admin filters.

**Query Parameters:** All from regular documents plus:
- `status`: string[]
- `processingErrors`: boolean
- `dateRange`: {start: string, end: string}

#### PATCH /api/admin/documents/:id
Bulk update document metadata.

#### DELETE /api/admin/documents/:id
Delete document with cleanup.

#### POST /api/admin/documents/:id/reprocess
Retry failed processing.

#### GET /api/admin/stats
System statistics.

**Response:**
```json
{
  "totalDocuments": 1500,
  "totalStorage": "2.5GB",
  "documentsByStatus": {
    "pending": 10,
    "processing": 5,
    "completed": 1480,
    "failed": 5
  },
  "recentUploads": 25,
  "queueStats": {
    "waiting": 3,
    "active": 2,
    "completed": 1450,
    "failed": 8
  }
}
```

### Queue Management

#### GET /api/admin/queue/stats
Job queue statistics.

#### GET /api/admin/queue/jobs
List jobs with filtering.

#### POST /api/admin/queue/jobs/:id/retry
Retry failed job.

#### DELETE /api/admin/queue/jobs/:id
Remove job from queue.

#### POST /api/admin/queue/clean
Clean old completed/failed jobs.

### User Management

#### GET /api/admin/users
List users with filtering.

#### POST /api/admin/users
Create user (admin only).

#### PATCH /api/admin/users/:id
Update user (role, status, etc.).

#### DELETE /api/admin/users/:id
Delete user.

### Tag Management

#### GET /api/admin/tags
List all tags with usage counts.

#### POST /api/admin/tags
Create tag metadata.

#### PATCH /api/admin/tags/:id
Update tag (rename propagates to all documents).

#### DELETE /api/admin/tags/:id
Delete tag (remove from all documents).

### Validation & Health

#### GET /api/admin/validation/issues
Find data quality issues.

#### POST /api/admin/validation/fix
Auto-fix common issues.

#### GET /api/admin/health
Comprehensive system health.

#### GET /api/admin/health/services/:service
Health of specific service.

---

## Error Responses

All errors follow this format:

```json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": { /* additional error info */ }
}
```

### Common HTTP Status Codes

- `200`: Success
- `201`: Created
- `400`: Bad Request
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found
- `409`: Conflict
- `422`: Validation Error
- `500`: Internal Server Error

### Common Error Codes

- `VALIDATION_ERROR`: Request validation failed
- `UNAUTHORIZED`: Missing or invalid authentication
- `FORBIDDEN`: Insufficient permissions
- `NOT_FOUND`: Resource not found
- `CONFLICT`: Resource conflict (duplicate, etc.)
- `PROCESSING_FAILED`: Document processing error