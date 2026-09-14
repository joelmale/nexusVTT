# Frontend Documentation

This document provides a detailed overview of the frontend architecture of Nexus VTT.

## Project Structure

The frontend code is located in the `apps/vtt/src` directory and follows a standard React project structure:

```
apps/vtt/src/
├── assets/            # Static assets like images and icons
├── components/        # React components
├── stores/            # Zustand state management
├── styles/            # CSS stylesheets
├── types/             # TypeScript type definitions
└── utils/             # Utility functions and services
```

## Components

The UI is built with a modular component architecture. The main components are:

- **`Layout.tsx`:** The main layout of the application, including the header, navigation, and main content area.
- **`Lobby.tsx`:** The lobby where users can create or join a game.
- **`DiceRoller.tsx`:** The dice rolling interface.
- **`Placeholder.tsx`:** A placeholder component for features that are not yet implemented.

## State Management

State management is handled by Zustand, a small and fast state management library for React. The main store is defined in `apps/vtt/src/stores/gameStore.ts`.

### `useGameStore`

The `useGameStore` hook provides access to the game state and actions. The state includes:

- **`user`:** Information about the current user.
- **`session`:** Information about the current game session.
- **`diceRolls`:** A list of recent dice rolls.
- **`activeTab`:** The currently active tab in the UI.

### Actions

The store also includes actions for updating the state, such as:

- **`setUser`:** Updates the user's information.
- **`setSession`:** Sets the current game session.
- **`addDiceRoll`:** Adds a new dice roll to the list.
- **`setActiveTab`:** Sets the active tab.
- **`applyEvent`:** Applies an event received from the server to the game state.

## WebSocket Service

The WebSocket service in `apps/vtt/src/utils/websocket.ts` manages the connection to the server.

### `WebSocketService`

The `WebSocketService` class provides the following functionality:

- **`connect(roomCode?: string)`:** Connects to the WebSocket server. If a `roomCode` is provided, it attempts to join that room.
- **`disconnect()`:** Disconnects from the WebSocket server.
- **`sendEvent(event: GameEvent)`:** Sends a game event to the server.
- **`sendDiceRoll(roll: any)`:** Sends a dice roll to the server.

### Connection Management

The service automatically handles reconnection attempts with exponential backoff if the connection is lost. It also queues messages sent while the connection is down and sends them once the connection is re-established.
