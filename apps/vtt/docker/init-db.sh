#!/bin/bash
set -e

# PostgreSQL initialization script for integrated Nexus VTT + NexusCodex
# Creates separate databases for VTT and documents

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" <<-EOSQL
    -- Create Nexus VTT database
    CREATE DATABASE nexus;
    GRANT ALL PRIVILEGES ON DATABASE nexus TO nexus;

    -- Create NexusCodex documents database
    CREATE DATABASE nexus_docs;
    GRANT ALL PRIVILEGES ON DATABASE nexus_docs TO nexus;

    -- Log completion
    \echo 'Databases created: nexus, nexus_docs'
EOSQL

echo "✅ PostgreSQL initialization complete"
echo "   - nexus: Nexus VTT database (campaigns, users, sessions, characters)"
echo "   - nexus_docs: NexusCodex database (documents, annotations, bookmarks)"
