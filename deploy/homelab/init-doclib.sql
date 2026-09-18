-- Initializes the doclib database for NexusCodex on the shared PostgreSQL instance.
-- Run with:
--   docker exec -i nexus-vtt2-postgres psql -U nexus -d nexus < deploy/homelab/init-doclib.sql

SELECT 'CREATE DATABASE doclib'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'doclib')\gexec

GRANT ALL PRIVILEGES ON DATABASE doclib TO CURRENT_USER;
