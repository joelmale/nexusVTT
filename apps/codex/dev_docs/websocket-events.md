# WebSocket Events

NexusCodex uses WebSocket connections for real-time collaboration features, allowing multiple users to view and interact with documents simultaneously.

## Connection

### WebSocket URL
```
ws://localhost:3002/ws
```

### Authentication
WebSocket connections require JWT authentication. Include the token as a query parameter:

```
ws://localhost:3002/ws?token=<jwt_token>
```

### Message Format
All messages follow this JSON structure:

```json
{
  "type": "event_type",
  "data": {
    // event-specific payload
  }
}
```

## Session Management

### Creating a Session
**Event:** `doc:session:create`

**Purpose:** Create a new document viewing session for real-time collaboration.

**Payload:**
```json
{
  "documentId": "uuid",
  "campaignId": "string",
  "roomCode": "string",
  "presenter": "user-id",
  "syncSettings": {
    "syncScroll": true,
    "syncPage": true,
    "syncHighlight": true
  }
}
```

**Response:** `session:created`
```json
{
  "sessionId": "uuid",
  "documentId": "uuid",
  "campaignId": "string",
  "presenter": "user-id",
  "participants": ["user-id"],
  "syncSettings": {
    "syncScroll": true,
    "syncPage": true,
    "syncHighlight": true
  },
  "createdAt": "timestamp"
}
```

### Joining a Session
**Event:** `doc:session:join`

**Purpose:** Join an existing document viewing session.

**Payload:**
```json
{
  "sessionId": "uuid",
  "userId": "string"
}
```

**Response:** `session:joined`
```json
{
  "session": {
    "sessionId": "uuid",
    "documentId": "uuid",
    "campaignId": "string",
    "presenter": "user-id",
    "participants": ["user-id-1", "user-id-2"],
    "syncSettings": { /* ... */ }
  },
  "userId": "string"
}
```

**Broadcast:** To all session participants
```json
{
  "sessionId": "uuid",
  "userId": "string",
  "action": "joined"
}
```

### Leaving a Session
**Event:** `doc:session:leave`

**Payload:**
```json
{
  "sessionId": "uuid"
}
```

**Broadcast:** `session:left`
```json
{
  "sessionId": "uuid",
  "userId": "string"
}
```

### Updating Session Settings
**Event:** `doc:session:update-settings`

**Purpose:** Modify synchronization settings for the session.

**Payload:**
```json
{
  "sessionId": "uuid",
  "syncSettings": {
    "syncScroll": false,
    "syncPage": true,
    "syncHighlight": true
  }
}
```

**Broadcast:** `session:updated`
```json
{
  "sessionId": "uuid",
  "syncSettings": {
    "syncScroll": false,
    "syncPage": true,
    "syncHighlight": true
  }
}
```

## Page Navigation

### Page Changes
**Event:** `doc:page:change`

**Purpose:** Navigate to a different page in the document.

**Payload:**
```json
{
  "sessionId": "uuid",
  "page": 5
}
```

**Broadcast:** `page:changed` (only if syncPage is enabled)
```json
{
  "sessionId": "uuid",
  "page": 5,
  "changedBy": "user-id"
}
```

### Scroll Synchronization
**Event:** `doc:scroll:sync`

**Purpose:** Synchronize scroll position across viewers.

**Payload:**
```json
{
  "sessionId": "uuid",
  "position": 0.75
}
```

**Broadcast:** `scroll:synced` (only if syncScroll is enabled)
```json
{
  "sessionId": "uuid",
  "position": 0.75,
  "syncedBy": "user-id"
}
```

## DM Push Features

### Force Page Navigation
**Event:** `doc:push:page`

**Purpose:** DM forces all players to navigate to a specific page (bypasses sync settings).

**Payload:**
```json
{
  "sessionId": "uuid",
  "page": 10
}
```

**Broadcast:** `page:pushed` (always broadcasts, ignores sync settings)
```json
{
  "sessionId": "uuid",
  "page": 10,
  "pushedBy": "dm-user-id"
}
```

### Push Document Reference
**Event:** `doc:push:reference`

**Purpose:** DM pushes a bookmarked reference to all players.

**Payload:**
```json
{
  "sessionId": "uuid",
  "referenceId": "uuid"
}
```

**Broadcast:** `reference:pushed`
```json
{
  "sessionId": "uuid",
  "reference": {
    "id": "uuid",
    "documentId": "uuid",
    "title": "string",
    "pageNumber": 5,
    "notes": "string"
  },
  "pushedBy": "dm-user-id"
}
```

## Real-time Annotations

### Creating Annotations
**Event:** `doc:annotation:create`

**Purpose:** Create a new annotation that syncs across all viewers.

**Payload:**
```json
{
  "sessionId": "uuid",
  "annotation": {
    "documentId": "uuid",
    "referenceId": "uuid", // optional
    "userId": "string",
    "campaignId": "string", // optional
    "pageNumber": 3,
    "position": {
      "x": 100,
      "y": 200,
      "width": 150,
      "height": 50
    },
    "type": "highlight", // "highlight" | "note" | "drawing"
    "content": "Important rule clarification",
    "color": "#FFFF00",
    "isShared": true
  }
}
```

**Broadcast:** `annotation:created` (only if syncHighlight is enabled)
```json
{
  "sessionId": "uuid",
  "annotation": {
    "id": "uuid",
    "documentId": "uuid",
    "userId": "string",
    "pageNumber": 3,
    "position": { /* ... */ },
    "type": "highlight",
    "content": "Important rule clarification",
    "color": "#FFFF00",
    "createdAt": "timestamp"
  }
}
```

### Updating Annotations
**Event:** `doc:annotation:update`

**Payload:**
```json
{
  "sessionId": "uuid",
  "annotationId": "uuid",
  "updates": {
    "content": "Updated note content",
    "color": "#FF0000",
    "position": {
      "x": 120,
      "y": 220,
      "width": 180,
      "height": 60
    }
  }
}
```

**Broadcast:** `annotation:updated`
```json
{
  "sessionId": "uuid",
  "annotationId": "uuid",
  "updates": { /* ... */ },
  "updatedAt": "timestamp"
}
```

### Deleting Annotations
**Event:** `doc:annotation:delete`

**Payload:**
```json
{
  "sessionId": "uuid",
  "annotationId": "uuid"
}
```

**Broadcast:** `annotation:deleted`
```json
{
  "sessionId": "uuid",
  "annotationId": "uuid",
  "deletedBy": "user-id"
}
```

## Error Handling

### Error Events
**Event:** `error`

**Purpose:** Server-side errors are broadcast to clients.

```json
{
  "type": "error",
  "code": "SESSION_NOT_FOUND",
  "message": "Session does not exist",
  "sessionId": "uuid"
}
```

### Common Error Codes
- `SESSION_NOT_FOUND`: Invalid session ID
- `SESSION_FULL`: Session participant limit reached
- `UNAUTHORIZED`: Invalid or missing authentication
- `PERMISSION_DENIED`: User not authorized for action
- `VALIDATION_ERROR`: Invalid event payload
- `DOCUMENT_NOT_FOUND`: Referenced document doesn't exist

## Connection Lifecycle

### Connecting
1. Client establishes WebSocket connection with JWT token
2. Server validates token and establishes session
3. Client can now send/receive events

### Disconnecting
1. Client disconnects or connection is lost
2. Server automatically removes user from active sessions
3. Other participants receive `session:left` event

### Reconnecting
1. Client reconnects with same JWT token
2. Server validates token
3. Client can rejoin previous sessions or create new ones

## Session Persistence

### Redis Storage
Sessions are stored in Redis with TTL (default: 3600 seconds / 1 hour):

```json
{
  "sessionId": "uuid",
  "documentId": "uuid",
  "campaignId": "string",
  "presenter": "user-id",
  "participants": ["user-id-1", "user-id-2"],
  "syncSettings": { /* ... */ },
  "createdAt": "timestamp",
  "expiresAt": "timestamp"
}
```

### Cleanup
- Expired sessions are automatically cleaned up
- Inactive participants are removed after timeout
- Session data persists across server restarts (Redis-backed)

## Security Considerations

### Authentication
- JWT tokens required for all connections
- Token validation on connection establishment
- Automatic disconnect on invalid/expired tokens

### Authorization
- Session presenters (DMs) have elevated permissions
- Push features restricted to session presenters
- Annotation permissions based on user roles

### Rate Limiting
- Connection rate limiting to prevent abuse
- Event rate limiting per client
- Automatic disconnect for excessive traffic

## Implementation Notes

### Client Libraries
```javascript
// Connection
const ws = new WebSocket('ws://localhost:3002/ws?token=' + jwtToken);

// Sending events
ws.send(JSON.stringify({
  type: 'doc:session:create',
  data: { documentId: 'uuid', /* ... */ }
}));

// Receiving events
ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  handleEvent(message.type, message.data);
};
```

### Server Architecture
- Express.js with `ws` library for WebSocket support
- Event-based architecture with Zod validation
- Redis for session state management
- Automatic cleanup of stale connections

### Scalability
- Stateless WebSocket servers (state in Redis)
- Horizontal scaling support
- Load balancer sticky sessions for optimal performance
- Redis pub/sub for cross-server event broadcasting