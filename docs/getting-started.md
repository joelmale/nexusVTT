# Getting Started

This guide will walk you through setting up your development environment for Nexus VTT. By the end of this guide, you will have the application running on your local machine.

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js:** Version 26.5.0 or newer in the Node 26 line.
- **npm:** Version 11 (installed with the supported Node toolchain).
- **Git:** For cloning the repository.
- **Docker Desktop:** Must be installed and running.

## Development Setup

1.  **Clone the Repository**

    ```bash
    git clone https://github.com/your-username/nexus-vtt.git
    cd nexus-vtt
    ```

2.  **Install Dependencies**

    ```bash
    npm install
    ```

3.  **Configure Environment**
    Create a new file named `.env.local` in the project root and add the database connection string:

    ```
    DATABASE_URL="postgres://nexus:password@localhost:5432/nexus"
    ```

4.  **Start Development Database**
    In a separate terminal, run the following command to start the PostgreSQL container:

    ```bash
    docker compose -f docker/docker-compose.dev.yml up -d postgres-dev
    ```

5.  **Run the Application**
    Once the database is running, use this command to start the frontend and backend servers:
    ```bash
    npm run start:all
    ```

## Usage

Once the application is running, you can open your browser to the frontend URL (typically `http://localhost:5173`) and start using the application.

### Creating a Game

1. Enter your name in the lobby.
2. Click "Host Game".
3. Share the generated room code with your players.

### Joining a Game

1. Enter your name in the lobby.
2. Enter the room code from your DM.
3. Click "Join Game".
