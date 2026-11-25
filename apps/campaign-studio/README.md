# Campaign Studio

Campaign Studio is the DM preparation workspace served by the Nexus VTT
gateway at `/codex-dm/`. It manages campaign objects, maps, encounters,
handouts, and session plans. Campaign authoring uses the signed-in VTT API and
PostgreSQL. JSON exports provide portable campaign backups.

## Start locally

From the monorepo root, use the Node version in `.nvmrc` with npm 11.

```bash
npm ci
npm run build:workspace-deps -- --workspace @nexus/campaign-studio
npm run dev --workspace @nexus/campaign-studio
```

Open `http://localhost:3003/codex-dm/`. Start the VTT backend for signed-in
campaign authoring. Vite proxies `/api`, `/auth`, and `/users` to
`VITE_VTT_API_URL` (default `http://localhost:5001`) and `/codex-api` to
`VITE_DOC_API_URL` (default `http://localhost:3000`). The read-only Ashes of
Veyra demo is available at `/codex-dm/demo/ashes-of-veyra/`.

## Author and run a session

A campaign owner can invite existing accounts as co-DMs in Campaign Settings.
Owners and co-DMs can edit and publish prep. The owner manages membership and
controls live session activation, advancement, and encounter deployment.
Studio checks the saved revision on each write and offers a reload or keep-my-
changes choice when edits conflict.

Published session plans pin their referenced revisions. Activation binds a
published plan to a VTT session. The VTT owns live scenes, encounters, and
actors. See the [Campaign Studio boundary](../docs/vtt/adr/0006-campaign-studio-sidecar-boundary.md).

## Build and test

```bash
npm run build --workspace @nexus/campaign-studio
npm test --workspace @nexus/campaign-studio
npm run test:e2e --workspace nexus-vtt -- studio-authoring
```

The [gateway Dockerfile](../vtt/docker/frontend.Dockerfile) builds Studio for
production. Use the [deployment guide](../../DEPLOYMENT.md) for the integrated
stack and health checks.
