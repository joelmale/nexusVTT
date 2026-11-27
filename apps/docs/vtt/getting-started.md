# Getting Started

This guide will walk you through setting up your development environment for Nexus VTT. By the end of this guide, you will have the application running on your local machine.

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js:** Version 26.5.1 or newer in the Node 26 line.
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

    `ash
    cd apps/vtt
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
    docker compose -f apps/vtt/docker/docker-compose.dev.yml up -d postgres-dev
    ```

5.  **Run the Application**
    Once the database is running, use this command to start the frontend and backend servers:
    ```bash
    cd apps/vtt
    npm run start:all
    ```

## Usage

Once the application is running, you can open your browser to the frontend URL (typically `http://localhost:5173`) and start using the application.

### Creating a game

1. Open **Host a game** in the lobby and enter your host display name.
2. Select a saved campaign if you are signed in, then choose **Create game**.
3. Finish setting up the room and share its code with your players.

### Joining a game

1. Enter the four-character room code and your display name in the lobby.
2. Open **Join options** if you want to spectate or upload a token image.
3. Choose **Join game**.

### Returning to a saved table

Sign in to open Campaign Home at `/campaign-home`. Use **My tables** to resume your most recent table or open another saved table. The table of contents also includes a **Dashboard** link for managing your campaigns and characters.
