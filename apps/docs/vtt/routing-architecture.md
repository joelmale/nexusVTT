# Routing Architecture

## Overview

This application uses React Router for URL-based routing.
Each page has its own URL, making the app more intuitive and testable.

## Route Structure

### Public Routes

- `GET /` - Redirects to /lobby
- `GET /lobby` - Welcome/landing page

### Game Setup Routes

- `GET /lobby/player-setup` - Player configuration
- `GET /lobby/dm-setup` - DM game configuration

### Active Game Routes

- `GET /lobby/game/:roomCode` - Active game session

### User Routes

- `GET /dashboard` - User dashboard (requires authentication)

### Development Routes

- `GET /admin` - Admin panel (dev mode only)

## Navigation Patterns

### Between Pages

Use React Router's `useNavigate()` hook:

```typescript
import { useNavigate } from 'react-router-dom';

const navigate = useNavigate();
navigate('/lobby/dm-setup');
```

### With State/Data

Pass data via URL params or search params:

```typescript
// URL param
navigate(`/lobby/game/${roomCode}`);

// Search param
navigate(`/lobby/player-setup?character=${characterId}`);
```

### Back Navigation

```typescript
navigate(-1); // Go back one page
navigate('/lobby'); // Explicit navigation
```

## Session Recovery

Game sessions are recovered on refresh via:

1. URL room code (`/lobby/game/:roomCode`)
2. localStorage session data
3. WebSocket reconnection

See `LinearGameLayout.tsx` for implementation.

## Migration Notes

Previously, the app used Zustand view state (`view: AppView`) for routing.
This caused issues with browser refresh and URL sharing.

Migration completed: [Date]
Old approach removed: Phase 3
