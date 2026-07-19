# Installation Guide

This guide will walk you through setting up Nexus VTT for local development.

## 📋 Prerequisites

- **Node.js 26.5.0+ (Node 26 line)** - [Download from nodejs.org](https://nodejs.org/)
- **Docker Desktop** - [Download from docker.com](https://www.docker.com/products/docker-desktop/) (must be installed and running)
- **Git** - [Download from git-scm.com](https://git-scm.com/)
- **Modern web browser** - Chrome, Firefox, Safari, or Edge

## 🚀 Development Setup

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
    Create a new file named `.env.local` in the root of the project and add the following line. This provides the connection string for the local development database.

    ```
    DATABASE_URL="postgres://nexus:password@localhost:5432/nexus"
    ```

4.  **Start the Database**
    In a separate terminal, start the PostgreSQL database container using Docker Compose.

    ```bash
    docker compose -f docker/docker-compose.dev.yml up -d postgres-dev
    ```

5.  **Run the Application**
    Once the database is running, start the frontend and backend development servers.
    ```bash
    npm run start:all
    ```

That's it! The application will be running at:

- **Frontend**: http://localhost:5173
- **Backend**: http://localhost:5001

## 🐳 Docker Installation (Optional)\n\nFor containerized deployment:\n\n`bash\n# Build and start all services\ndocker-compose up --build\n`\n\nSee [Docker Setup](deployment/docker.md) for detailed Docker instructions.\n\n## ⚙️ Configuration\n\n### Environment Variables\n\nCreate a `.env` file in the project root:\n\n`bash\n# Frontend configuration\nVITE_ASSET_SERVER_URL=http://localhost:8080\n\n# WebSocket server\nPORT=5000\n\n# Asset server\nASSET_PORT=8080\nASSETS_PATH=./asset-server/assets\nCORS_ORIGIN=*\n`\n\n### Port Configuration\n\nIf default ports are busy, you can use alternatives:\n\n`bash\n# Frontend on different port\nPORT=3000 npm run dev\n\n# WebSocket server on different port  \nPORT=5001 npm run server:dev\n\n# Asset server on different port\nPORT=8081 npm run dev  # (in asset-server directory)\n`\n\n## 🔍 Verification\n\n### Check if everything is running:\n\n1. **Frontend**: Open http://localhost:5173 - should show Nexus VTT lobby\n2. **WebSocket**: Check browser console - should show \"WebSocket connected\"\n3. **Asset Server**: Open http://localhost:8080/health - should return JSON status\n\n### Test Asset Processing:\n\n`bash\n# Check if Sharp (image processing) is working\nnode -e \"console.log(require('sharp'))\"\n\n# Process a test image\nnode scripts/process-assets.js /path/to/test/image ./test-output\n`\n\n## 🚨 Troubleshooting\n\n### Common Issues\n\n**Port conflicts:**\n`bash\n# Check what's using your ports\nlsof -i :5173  # Frontend\nlsof -i :5001  # WebSocket\nlsof -i :8080  # Asset Server\n`\n\n**Sharp installation issues:**\n`bash\n# Reinstall Sharp\nnpm uninstall sharp\nnpm install sharp\n`\n\n**Asset server won't start:**\n`bash\n# Check if dependencies are installed\ncd asset-server\nls node_modules  # Should show installed packages\n`\n\n**Permission errors:**\n`bash\n# Make sure you have read access to asset folders\nls -la /path/to/your/assets\n`\n\nFor more troubleshooting, see [Common Issues](troubleshooting/common-issues.md).\n\n## 🎯 Next Steps\n\n- 📖 [User Guide](user/player-guide.md) - Learn how to use Nexus VTT\n- 🎨 [Asset Management](user/asset-management.md) - Organize your maps and tokens\n- 🔧 [Development Guide](developer/development.md) - Start contributing\n- 🎲 [Create Your First Game](first-game.md) - Set up a game session\n\n---\n\n**Having issues?** Check our [troubleshooting guides](troubleshooting/) or [open an issue](https://github.com/your-username/nexus-vtt/issues).\n
