# Server-Authoritative 3D Dice Rolling System

This document describes the implementation of the server-authoritative 3D dice rolling system with synchronized animations across all clients.

## Architecture Overview

The system follows a secure, client-server architecture where:

1. **Client** initiates a dice roll request
2. **Server** generates cryptographically secure random numbers
3. **Server** broadcasts the results to all clients in the room
4. **All clients** animate the dice with predetermined results

This ensures:
- **Security**: No client-side cheating (results are server-generated)
- **Synchronization**: All players see the same roll
- **Visual feedback**: Realistic 3D physics-based dice animations

## Workflow

```
┌─────────┐                    ┌─────────┐                     ┌─────────┐
│ Client  │                    │  Server │                     │ Other   │
│   A     │                    │         │                     │ Clients │
└────┬────┘                    └────┬────┘                     └────┬────┘
     │                              │                               │
     │  1. Click "Roll" button      │                               │
     ├────────────────────────────> │                               │
     │  dice/roll-request            │                               │
     │  { expression: "2d6+3" }      │                               │
     │                               │                               │
     │                               │ 2. Generate random numbers    │
     │                               │    using crypto.randomBytes() │
     │                               │                               │
     │                               │ 3. Broadcast result           │
     │  <─────────────────────────── ├─────────────────────────────> │
     │  dice/roll-result             │  dice/roll-result             │
     │  { roll: { pools, results } } │  { roll: { pools, results } } │
     │                               │                               │
     │  4. Animate dice with         │                               │  4. Animate dice
     │     predetermined results     │                               │     (same results)
     │                               │                               │
     └───────────────────────────────┴───────────────────────────────┘
```

## Components

### 1. Server-Side (`apps/vtt/server/diceRoller.ts`)

#### `createServerDiceRoll()`
Generates cryptographically secure dice rolls using Node.js `crypto.randomBytes()`.

**Features:**
- Supports complex expressions: `2d6+3`, `3d4, 6d20`, `1d20+2d6+1d4+3`
- Advantage/disadvantage mechanics
- Critical success/failure detection (d20)
- Expression validation and limits

**Example:**
```typescript
const roll = createServerDiceRoll(
  "2d6+1d4+3",
  userId,
  userName,
  { advantage: true }
);

// Returns:
{
  id: "roll-1234567890-abc123",
  userId: "user-123",
  userName: "Alice",
  expression: "2d6+1d4+3",
  pools: [
    { count: 2, sides: 6, results: [4, 5] },
    { count: 1, sides: 4, results: [3] }
  ],
  modifier: 3,
  results: [4, 5, 3],
  total: 15,
  timestamp: 1234567890,
  isPrivate: false
}
```

#### Cryptographic RNG
```typescript
function secureRandomInt(min: number, max: number): number {
  const range = max - min + 1;
  const bytesNeeded = Math.ceil(Math.log2(range) / 8);
  const maxValue = Math.pow(256, bytesNeeded);
  const threshold = maxValue - (maxValue % range);

  let value: number;
  do {
    const randomBytes = crypto.randomBytes(bytesNeeded);
    value = 0;
    for (let i = 0; i < bytesNeeded; i++) {
      value = value * 256 + randomBytes[i];
    }
  } while (value >= threshold);

  return min + (value % range);
}
```

This method ensures:
- No modulo bias
- Cryptographically secure randomness
- Uniform distribution

### 2. WebSocket Server (`apps/vtt/server/index.ts`)

#### Event Handling
```typescript
private handleDiceRollRequest(fromUuid: string, connection: Connection, data: any) {
  // 1. Validate request
  const validation = validateDiceRollRequest(data);
  if (!validation.valid) {
    this.sendError(connection, validation.error);
    return;
  }

  // 2. Generate roll
  const roll = createServerDiceRoll(
    data.expression,
    fromUuid,
    userName,
    {
      isPrivate: data.isPrivate,
      advantage: data.advantage,
      disadvantage: data.disadvantage,
    }
  );

  // 3. Broadcast to all clients
  this.broadcastToRoom(connection.room, {
    type: 'event',
    data: {
      type: 'dice/roll-result',
      roll,
    },
  });
}
```

### 3. Client-Side 3D Dice (`apps/vtt/src/components/DiceBox3D.tsx`)

Uses `@3d-dice/dice-box` library for realistic 3D physics-based dice animations.

**Features:**
- WebGL-based rendering
- Cannon.js physics engine
- Predetermined results (server-provided)
- Multiple dice types: d4, d6, d8, d10, d12, d20, d100

**Usage:**
```tsx
<DiceBox3D
  roll={{
    pools: [
      { count: 2, sides: 6, results: [4, 5] },
      { count: 1, sides: 20, results: [18] }
    ],
    expression: "2d6+1d20"
  }}
  onComplete={() => console.log('Animation complete')}
/>
```

**How it works:**
```typescript
// Convert server results to dice-box notation
const diceNotation = ['d6', 'd6', 'd20'];
const resultValues = [4, 5, 18]; // From server

// Roll with predetermined results
await diceBox.roll(diceNotation, {
  values: resultValues, // Forces dice to land on these values
});
```

### 4. Dice Roller Component (`apps/vtt/src/components/DiceRoller.tsx`)

#### Request Flow
```typescript
const handleRoll = () => {
  // Send request to server
  webSocketService.sendEvent({
    type: 'dice/roll-request',
    data: {
      expression: expression.trim(),
      isPrivate: isHost && isPrivate,
      advantage: rollMode === 'advantage',
      disadvantage: rollMode === 'disadvantage',
    }
  });
};

// Listen for server response
useEffect(() => {
  const handleDiceRollResult = (event: any) => {
    if (event.type === 'dice/roll-result' && event.roll) {
      const roll = event.roll;

      // Show 3D animation
      setAnimatedRoll(roll);
      setShowAnimation(true);

      // Play sounds
      diceSounds.playRollSound(roll.pools.length);
      if (roll.crit === 'success') {
        diceSounds.playCritSuccessSound();
      }
    }
  };

  return webSocketService.subscribe(handleDiceRollResult);
}, []);
```

## Message Protocol

### Client → Server: Roll Request
```json
{
  "type": "event",
  "data": {
    "type": "dice/roll-request",
    "expression": "2d6+1d4+3",
    "isPrivate": false,
    "advantage": false,
    "disadvantage": false
  },
  "timestamp": 1234567890,
  "src": "user-uuid-123"
}
```

### Server → All Clients: Roll Result
```json
{
  "type": "event",
  "data": {
    "type": "dice/roll-result",
    "roll": {
      "id": "roll-1234567890-abc123",
      "userId": "user-uuid-123",
      "userName": "Alice",
      "expression": "2d6+1d4+3",
      "pools": [
        {
          "count": 2,
          "sides": 6,
          "results": [4, 5]
        },
        {
          "count": 1,
          "sides": 4,
          "results": [3]
        }
      ],
      "modifier": 3,
      "results": [4, 5, 3],
      "total": 15,
      "crit": null,
      "timestamp": 1234567890,
      "isPrivate": false
    }
  },
  "src": "user-uuid-123",
  "timestamp": 1234567890
}
```

## Security Considerations

### Why Server-Authoritative?

1. **Prevents Cheating**: Clients cannot manipulate roll results
2. **Ensures Fairness**: All players see identical results
3. **Audit Trail**: Server logs all rolls for game history
4. **Cryptographic Quality**: Uses Node.js crypto for true randomness

### Validation

The server validates:
- Expression format (regex validation)
- Dice count limits (max 100 dice per roll)
- Dice sides limits (2-1000 sides)
- Expression length (max 100 characters)
- User permissions (only host can make private rolls)

### Rate Limiting

Consider adding rate limiting to prevent spam:
```typescript
const RATE_LIMIT = 10; // rolls per minute
const rollCounts = new Map<string, number[]>();

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const userRolls = rollCounts.get(userId) || [];
  const recentRolls = userRolls.filter(time => now - time < 60000);

  if (recentRolls.length >= RATE_LIMIT) {
    return false; // Exceeded rate limit
  }

  recentRolls.push(now);
  rollCounts.set(userId, recentRolls);
  return true;
}
```

## Dice Themes & Customization

The `@3d-dice/dice-box` library supports multiple themes and customization options:

### Available Themes
- `default` - Classic style
- `smooth` - Smooth rounded edges
- `rock` - Rocky texture
- `gemstone` - Crystal-like appearance
- `metal` - Metallic finish
- `wooden` - Wood grain texture

### Theme Configuration
```typescript
const Box = new DiceBox('#dice-box-container', {
  theme: 'gemstone',        // Dice theme
  themeColor: '#6366f1',    // Primary color
  assetPath: '/assets/dice/',
  startingHeight: 8,        // Drop height
  throwForce: 6,            // Throw strength
  spinForce: 5,             // Spin amount
  lightIntensity: 0.9,      // Lighting
  enableShadows: true,      // Shadow rendering
});
```

### Custom Dice Models

To add custom dice models:

1. Place 3D models in `apps/vtt/public/assets/dice/models/`
2. Update DiceBox configuration:
```typescript
const Box = new DiceBox('#dice-box-container', {
  assetPath: '/assets/dice/',
  theme: 'custom',
  customTheme: {
    d4: '/assets/dice/models/custom-d4.gltf',
    d6: '/assets/dice/models/custom-d6.gltf',
    d8: '/assets/dice/models/custom-d8.gltf',
    d10: '/assets/dice/models/custom-d10.gltf',
    d12: '/assets/dice/models/custom-d12.gltf',
    d20: '/assets/dice/models/custom-d20.gltf',
    d100: '/assets/dice/models/custom-d100.gltf',
  }
});
```

## Performance Considerations

### Optimization Tips

1. **Lazy Loading**: Initialize DiceBox only when needed
2. **Pooling**: Reuse DiceBox instance for multiple rolls
3. **Cleanup**: Properly dispose of WebGL resources
4. **Mobile**: Reduce physics quality on mobile devices

```typescript
const Box = new DiceBox('#dice-box-container', {
  // Lower settings for mobile
  enableShadows: !isMobile,
  quality: isMobile ? 'low' : 'high',
  startingHeight: isMobile ? 4 : 8,
});
```

### Browser Compatibility

- ✅ Chrome 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Edge 90+
- ⚠️ Mobile browsers (reduced performance)

## Testing

### Unit Tests
```typescript
describe('Server Dice Roller', () => {
  test('generates valid roll', () => {
    const roll = createServerDiceRoll('2d6+3', 'user-1', 'Alice');
    expect(roll).not.toBeNull();
    expect(roll.pools).toHaveLength(1);
    expect(roll.pools[0].count).toBe(2);
    expect(roll.pools[0].sides).toBe(6);
    expect(roll.modifier).toBe(3);
  });

  test('validates expression', () => {
    const result = validateDiceRollRequest({ expression: 'invalid' });
    expect(result.valid).toBe(false);
  });
});
```

### Integration Tests
```typescript
describe('Dice Roll Flow', () => {
  test('client receives server roll', async () => {
    // Connect client
    await webSocketService.connect(roomCode);

    // Subscribe to rolls
    const rolls: any[] = [];
    webSocketService.subscribe((event) => {
      if (event.type === 'dice/roll-result') {
        rolls.push(event.roll);
      }
    });

    // Request roll
    webSocketService.sendEvent({
      type: 'dice/roll-request',
      data: { expression: '1d20' }
    });

    // Wait for response
    await waitFor(() => rolls.length > 0);

    expect(rolls[0].expression).toBe('1d20');
    expect(rolls[0].results).toHaveLength(1);
  });
});
```

## Future Enhancements

### Planned Features
- [ ] Dice theme selector in settings panel
- [ ] Custom dice colors per player
- [ ] Roll history persistence
- [ ] Roll macros/shortcuts
- [ ] Animated dice tray
- [ ] VTT integration (place dice results on scene)
- [ ] Statistics dashboard (roll distribution)
- [ ] Achievement system (roll streaks, etc.)

### Advanced Features
- [ ] Dice pool mechanics (shadowrun, etc.)
- [ ] Exploding dice
- [ ] Reroll mechanics
- [ ] Success counting
- [ ] Dice notation: `4d6kh3` (keep highest 3)

## Troubleshooting

### Common Issues

**Issue**: Dice not animating
- **Solution**: Check that WebGL is enabled in browser
- **Solution**: Verify asset path is correct
- **Solution**: Check browser console for errors

**Issue**: Rolls not synchronizing
- **Solution**: Verify WebSocket connection is established
- **Solution**: Check server logs for errors
- **Solution**: Ensure all clients are in the same room

**Issue**: Performance issues
- **Solution**: Lower quality settings for mobile
- **Solution**: Reduce number of simultaneous dice
- **Solution**: Disable shadows on low-end devices

## References

- [3D Dice Library](https://github.com/3d-dice/dice-box)
- [Cannon.js Physics](https://github.com/schteppe/cannon.js)
- [Three.js Documentation](https://threejs.org/docs/)
- [WebSocket Protocol](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket)
- [Crypto Random Numbers](https://nodejs.org/api/crypto.html#crypto_crypto_randombytes_size_callback)
