# First Game Setup

This guide walks through a small local Nexus VTT session.

## Start The App

1. Install dependencies and start the local stack:

   ```bash
   npm install
   npm run start:all
   ```

2. Open `http://localhost:5173`.
3. Enter a display name.
4. Start a guest game or sign in, depending on your local auth setup.
5. Create a room and copy the room code.

## Invite Players

Each player should:

1. Open `http://localhost:5173`.
2. Enter a display name.
3. Join with the room code from the host.
4. Confirm they can see the same room state as the host.

## Create A Simple Scene

1. Open the scene or map tools.
2. Add a background image from upload or from the asset library.
3. Configure the grid if you want tactical movement.
4. Place one or two tokens.
5. Move a token from another browser profile or device to confirm sync.

## Roll Dice

Use the dice roller for quick rolls such as:

```text
1d20+5
2d6+3
4d6kh3
1d100
```

Rolls are broadcast to connected players and preserved in the room history.

## Add Assets

For local asset processing, see [Asset Processing](assets/processing.md). The
current tooling writes processed assets under `static-assets/assets` and serves
library assets through the standalone asset service in `services/asset-service`.

Useful commands:

```bash
node scripts/process-assets.js /path/to/assets ./static-assets/assets
npm run generate-assets
npm run seed:library-assets
```

## Smoke Checks

During the first session, check:

- Room creation succeeds.
- A second browser can join with the room code.
- Dice rolls appear for both clients.
- Token or scene changes appear for both clients.
- Uploaded or processed images render in the scene.

## Troubleshooting

If players cannot connect, verify the backend is running on
`http://localhost:5001` and that the browser console is not reporting WebSocket
errors.

If images do not load, verify processed assets exist under `static-assets/assets`
and run `npm run generate-assets` again.

For deployment-oriented checks, use [Deployment Quick Reference](DEPLOYMENT_QUICKREF.md).
For development setup, use [Development Guide](developer/development.md).
