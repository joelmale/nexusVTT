# External Storage Notes

This file replaces an older Docker Swarm/NFS deployment guide. Nexus VTT now
runs as a Dockhand-managed Docker Compose stack on a single Docker Engine host.

## Current Recommendation

Use Docker named volumes for live PostgreSQL, Redis, and asset-service data.
Back up those volumes regularly instead of putting PostgreSQL or Redis live data
directly on NFS.

The production Compose file defines:

- `postgres-data`
- `redis-data`
- `nexus-assets`
- `nexus-user-assets`
- `nexus-library-assets`

## Backups To NAS/NFS

Use external NAS/NFS storage as a backup target, not as the live database data
directory.

Example PostgreSQL backup:

```bash
CONTAINER=$(docker ps -q -f name=postgres)
BACKUP_DIR=/mnt/docker-nas-vol1/nexusvtt/backups
mkdir -p "$BACKUP_DIR"

docker exec "$CONTAINER" pg_dump -U nexus nexus \
  | gzip > "$BACKUP_DIR/nexus-$(date +%Y%m%d-%H%M%S).sql.gz"
```

Example asset volume backup:

```bash
BACKUP_DIR=/mnt/docker-nas-vol1/nexusvtt/backups
docker run --rm \
  -v nexus-vtt2_nexus-library-assets:/source:ro \
  -v "$BACKUP_DIR":/backup \
  alpine tar -czf /backup/nexus-library-assets-$(date +%Y%m%d-%H%M%S).tar.gz -C /source .
```

Adjust the volume name to match the Dockhand stack prefix on the host.

## Restore

Restore PostgreSQL from a SQL dump into the running Postgres container:

```bash
gunzip -c /mnt/docker-nas-vol1/nexusvtt/backups/nexus-YYYYMMDD-HHMMSS.sql.gz \
  | docker exec -i "$(docker ps -q -f name=postgres)" psql -U nexus -d nexus
```

For volume restores, stop the affected service in Dockhand, restore into the
named volume, then redeploy the stack.

## Why Not Live NFS For Databases?

PostgreSQL and Redis are sensitive to latency, locking, and network
interruptions. A single-host Docker Engine deployment is simpler and safer with
local Docker volumes plus external backups.
