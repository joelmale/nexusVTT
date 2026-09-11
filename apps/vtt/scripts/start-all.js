#!/usr/bin/env node

/**
 * Intelligent development server starter with port conflict resolution and auto-database startup
 */

import { spawn, exec, execFile } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import net from "net";
import dotenv from "dotenv";
import { promisify } from "util";

const execAsync = promisify(exec);
const execFileAsync = promisify(execFile);

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, "../.env.local") });

// Colors
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  cyan: "\x1b[36m",
  magenta: "\x1b[35m",
  yellow: "\x1b[33m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  blue: "\x1b[34m",
};

function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  const envValues = {};
  const envFileContent = fs.readFileSync(filePath, "utf8");

  envFileContent.split("\n").forEach((line) => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#")) {
      const [key, ...valueParts] = trimmed.split("=");
      if (key) {
        envValues[key.trim()] = valueParts.join("=").trim();
      }
    }
  });

  return envValues;
}

function pickEnvValue(key, sources) {
  for (const source of sources) {
    const value = source[key];
    if (typeof value === "string" && value.trim() !== "") {
      return value.trim();
    }
  }
  return "";
}

// Port checking utility
function checkPort(port) {
  return new Promise((resolve) => {
    const server = net.createServer();

    server.listen(port, () => {
      server.once("close", () => resolve(true));
      server.close();
    });

    server.on("error", () => resolve(false));
  });
}

// Check if PostgreSQL is accepting connections
async function checkPostgresConnection(retries = 3, delay = 2000) {
  for (let i = 0; i < retries; i++) {
    try {
      const client = net.connect({ port: 5432, host: 'localhost' });

      await new Promise((resolve, reject) => {
        client.on('connect', () => {
          client.end();
          resolve(true);
        });
        client.on('error', reject);

        setTimeout(() => reject(new Error('Timeout')), 3000);
      });

      return true;
    } catch (error) {
      if (i < retries - 1) {
        console.log(`${colors.yellow}   Waiting for PostgreSQL to be ready... (${i + 1}/${retries})${colors.reset}`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  return false;
}

// Check if Docker is running
async function checkDockerRunning() {
  try {
    await execAsync('docker ps');
    return true;
  } catch (error) {
    return false;
  }
}

// Start PostgreSQL container
async function startPostgres() {
  console.log(`${colors.cyan}🐘 Starting PostgreSQL container...${colors.reset}`);

  try {
    // Check if Docker is running
    const dockerRunning = await checkDockerRunning();
    if (!dockerRunning) {
      console.log(`${colors.red}❌ Docker is not running!${colors.reset}`);
      console.log(`${colors.yellow}   Please start Docker Desktop and try again.${colors.reset}\n`);
      return false;
    }

    // Start PostgreSQL container
    const composeFile = path.join(__dirname, '../docker/docker-compose.dev.yml');
    await execAsync(`docker compose -f ${composeFile} up -d postgres-dev`);

    console.log(`${colors.green}✅ PostgreSQL container started${colors.reset}`);

    // Wait for PostgreSQL to be ready
    console.log(`${colors.cyan}⏳ Waiting for PostgreSQL to be ready...${colors.reset}`);
    const isReady = await checkPostgresConnection(10, 2000);

    if (isReady) {
      console.log(`${colors.green}✅ PostgreSQL is ready!${colors.reset}\n`);
      return true;
    } else {
      console.log(`${colors.red}❌ PostgreSQL failed to start${colors.reset}\n`);
      return false;
    }
  } catch (error) {
    console.log(`${colors.red}❌ Failed to start PostgreSQL: ${error.message}${colors.reset}\n`);
    return false;
  }
}

// Ensure PostgreSQL is running
async function ensurePostgres() {
  const isPortInUse = !(await checkPort(5432));

  if (isPortInUse) {
    // Port is in use, verify it's actually PostgreSQL responding
    const isConnectable = await checkPostgresConnection(1, 1000);
    if (isConnectable) {
      console.log(`${colors.green}✅ PostgreSQL is already running${colors.reset}\n`);
      return true;
    } else {
      console.log(`${colors.yellow}⚠️  Port 5432 is in use but not responding as PostgreSQL${colors.reset}`);
      console.log(`${colors.yellow}   You may need to stop the conflicting service${colors.reset}\n`);
      return false;
    }
  }

  // PostgreSQL is not running, start it
  return await startPostgres();
}

// Find available port starting from preferred port
async function findAvailablePort(startPort, maxAttempts = 10) {
  for (let i = 0; i < maxAttempts; i++) {
    const port = startPort + i;
    if (await checkPort(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

// Get user input
function getUserInput(question) {
  return new Promise((resolve) => {
    process.stdin.resume();
    process.stdin.setEncoding("utf8");

    console.log(question);

    process.stdin.once("data", (data) => {
      process.stdin.pause();
      resolve(data.toString().trim());
    });
  });
}

// Update .env file with ports
function updateEnvFile(ports) {
  const envPath = path.join(__dirname, "../.env");
  const envLocalPath = path.join(__dirname, "../.env.local");

  // Merge values from .env, .env.local, and current process env so we never
  // wipe out secrets when regenerating the file.
  const existingEnv = readEnvFile(envPath);
  const localEnv = readEnvFile(envLocalPath);
  const valueSources = [existingEnv, localEnv, process.env];

  const googleClientId = pickEnvValue("GOOGLE_CLIENT_ID", valueSources);
  const googleClientSecret = pickEnvValue("GOOGLE_CLIENT_SECRET", valueSources);
  const googleCallbackUrl = pickEnvValue("GOOGLE_CALLBACK_URL", valueSources);
  const discordClientId = pickEnvValue("DISCORD_CLIENT_ID", valueSources);
  const discordClientSecret = pickEnvValue("DISCORD_CLIENT_SECRET", valueSources);
  const databaseUrl = pickEnvValue("DATABASE_URL", valueSources);
  const sessionSecret = pickEnvValue("SESSION_SECRET", valueSources);
  const jwtSecret = pickEnvValue("JWT_SECRET", valueSources);
  const viteAssetServerUrl = pickEnvValue("VITE_ASSET_SERVER_URL", valueSources);
  const viteApiProxyUrl = pickEnvValue("VITE_API_PROXY_URL", valueSources);
  const viteWsProxyUrl = pickEnvValue("VITE_WS_PROXY_URL", valueSources);
  const docApiUrl = pickEnvValue("DOC_API_URL", valueSources);
  const assetApiUrl = pickEnvValue("ASSET_API_URL", valueSources);
  const assetServiceSecret = pickEnvValue("ASSET_SERVICE_SECRET", valueSources);
  const libraryDataPath = pickEnvValue("LIBRARY_DATA_PATH", valueSources);
  const libraryManifestPath = pickEnvValue("LIBRARY_MANIFEST_PATH", valueSources);
  const assetSeedSource = pickEnvValue("ASSET_SEED_SOURCE", valueSources);

  const databaseUrlValue = databaseUrl || "postgresql://user:password@localhost:5432/nexus";
  // Default to the doc-api port published by the nexuscodex docker stack on the host.
  const docApiUrlValue = docApiUrl || "http://localhost:3005";
  const assetApiUrlValue = assetApiUrl || `http://localhost:${ports.assetService}`;
  // Build new env content, preserving important variables
  const envContent = `# Vite Environment Variables
# Auto-generated by start-all script - ${new Date().toISOString()}

# Asset Server URL - uses same server as WebSocket (must start with VITE_ to be available in browser)
VITE_ASSET_SERVER_URL=${viteAssetServerUrl || `http://localhost:${ports.websocket}`}

# WebSocket Server URL (must start with VITE_ to be available in browser)
VITE_WS_PORT=${ports.websocket}

# Optional proxy overrides for Vite dev server
VITE_API_PROXY_URL=${viteApiProxyUrl}
VITE_WS_PROXY_URL=${viteWsProxyUrl}

# Development server ports
PORT=${ports.frontend}
WS_PORT=${ports.websocket}

# Database
DATABASE_URL=${databaseUrlValue}

# Google OAuth
GOOGLE_CLIENT_ID=${googleClientId}
GOOGLE_CLIENT_SECRET=${googleClientSecret}
GOOGLE_CALLBACK_URL=${googleCallbackUrl || `http://localhost:${ports.websocket}/auth/google/callback`}

# Discord OAuth
DISCORD_CLIENT_ID=${discordClientId}
DISCORD_CLIENT_SECRET=${discordClientSecret}

# Session Secrets
SESSION_SECRET=${sessionSecret || "dev-session-secret-change-in-production"}
JWT_SECRET=${jwtSecret || "dev-jwt-secret-change-in-production"}

# NexusCodex document service (doc-api; host port 3005 from the nexuscodex docker stack)
DOC_API_URL=${docApiUrlValue}

# Standalone asset service (services/asset-service)
ASSET_API_URL=${assetApiUrlValue}
ASSET_SERVICE_SECRET=${assetServiceSecret}
LIBRARY_DATA_PATH=${libraryDataPath || "./assets-data"}
LIBRARY_MANIFEST_PATH=${libraryManifestPath || "./assets-data/manifests/manifest-v2.json"}
ASSET_SEED_SOURCE=${assetSeedSource || "./asset-packs/tmt"}
`;

  fs.writeFileSync(envPath, envContent);
  console.log(
    `${colors.green}📝 Updated .env with selected ports (OAuth credentials preserved)${colors.reset}`
  );
}

class IntelligentStarter {
  constructor() {
    this.processes = [];
    this.isShuttingDown = false;
    this.defaultPorts = {
      frontend: 5173,
      websocket: 5001,
      assetService: 5003,
    };
  }

  async start() {
    console.log(
      `${colors.bright}🎲 Starting Nexus VTT Development Servers${colors.reset}`
    );

    // Ensure PostgreSQL is running first
    console.log(
      `${colors.cyan}🔍 Checking database...${colors.reset}\n`
    );

    const postgresReady = await ensurePostgres();
    if (!postgresReady) {
      console.log(
        `${colors.red}❌ Cannot start without PostgreSQL${colors.reset}`
      );
      console.log(
        `${colors.yellow}💡 To start PostgreSQL manually, run:${colors.reset}`
      );
      console.log(
        `${colors.bright}   docker compose -f docker/docker-compose.dev.yml up -d postgres-dev${colors.reset}\n`
      );
      process.exit(1);
    }

    console.log(
      `${colors.cyan}🔍 Checking port availability...${colors.reset}\n`
    );

    try {
      // Check default ports
      const portStatus = await this.checkDefaultPorts();

      if (portStatus.conflicts.length === 0) {
        console.log(
          `${colors.green}✅ All default ports are available!${colors.reset}\n`
        );
        await this.startServices(this.defaultPorts);
        return;
      }

      // Handle port conflicts
      await this.handlePortConflicts(portStatus);
    } catch (error) {
      console.error(
        `${colors.red}❌ Failed to start services: ${error.message}${colors.reset}`
      );
      process.exit(1);
    }
  }

  async checkDefaultPorts() {
    const status = { available: [], conflicts: [] };

    for (const [service, port] of Object.entries(this.defaultPorts)) {
      const isAvailable = await checkPort(port);

      if (isAvailable) {
        status.available.push({ service, port });
        console.log(
          `${colors.green}✅ Port ${port} (${service}) - Available${colors.reset}`
        );
      } else {
        status.conflicts.push({ service, port });
        console.log(
          `${colors.red}❌ Port ${port} (${service}) - In Use${colors.reset}`
        );
      }
    }

    return status;
  }

  async handlePortConflicts(portStatus) {
    console.log(
      `\n${colors.yellow}⚠️  Port conflicts detected!${colors.reset}`
    );
    console.log(`\n${colors.bright}What would you like to do?${colors.reset}`);
    console.log(`${colors.cyan}1.${colors.reset} Auto-select available ports`);
    console.log(`${colors.cyan}2.${colors.reset} Manually specify ports`);
    console.log(`${colors.cyan}3.${colors.reset} Show what's using the ports`);
    console.log(`${colors.cyan}4.${colors.reset} Abort startup`);

    const choice = await getUserInput(
      `\n${colors.bright}Enter your choice (1-4):${colors.reset}`
    );

    switch (choice) {
      case "1":
        await this.autoSelectPorts();
        break;
      case "2":
        await this.manualPortSelection(portStatus);
        break;
      case "3":
        await this.showPortUsage(portStatus.conflicts);
        await this.handlePortConflicts(portStatus); // Show menu again
        break;
      case "4":
        console.log(
          `${colors.yellow}🛑 Startup aborted by user${colors.reset}`
        );
        process.exit(0);
        break;
      default:
        console.log(
          `${colors.red}Invalid choice. Please enter 1-4.${colors.reset}`
        );
        await this.handlePortConflicts(portStatus);
    }
  }

  async autoSelectPorts() {
    console.log(
      `${colors.cyan}🔍 Auto-selecting available ports...${colors.reset}\n`
    );

    const ports = {
      frontend: await findAvailablePort(this.defaultPorts.frontend),
      websocket: await findAvailablePort(this.defaultPorts.websocket),
      assetService: await findAvailablePort(this.defaultPorts.assetService),
    };

    console.log(`${colors.green}✅ Selected ports:${colors.reset}`);
    console.log(`   Frontend:  ${ports.frontend}`);
    console.log(`   Backend:   ${ports.websocket} (WebSocket + Assets)`);
    console.log(`   Assets:    ${ports.assetService}\n`);

    await this.startServices(ports);
  }

  async manualPortSelection(portStatus) {
    console.log(`${colors.cyan}📝 Manual port selection:${colors.reset}\n`);

    const ports = { ...this.defaultPorts };

    for (const conflict of portStatus.conflicts) {
      const newPort = await getUserInput(
        `${colors.bright}Enter new port for ${conflict.service} (currently ${conflict.port}):${colors.reset}`
      );

      const portNum = parseInt(newPort);
      if (isNaN(portNum) || portNum < 1024 || portNum > 65535) {
        console.log(
          `${colors.red}Invalid port number. Using auto-selected port.${colors.reset}`
        );
        ports[conflict.service] = await findAvailablePort(conflict.port);
      } else if (!(await checkPort(portNum))) {
        console.log(
          `${colors.red}Port ${portNum} is also in use. Using auto-selected port.${colors.reset}`
        );
        ports[conflict.service] = await findAvailablePort(portNum);
      } else {
        ports[conflict.service] = portNum;
      }
    }

    console.log(`${colors.green}✅ Final port selection:${colors.reset}`);
    console.log(`   Frontend:  ${ports.frontend}`);
    console.log(`   Backend:   ${ports.websocket} (WebSocket + Assets)`);
    console.log(`   Assets:    ${ports.assetService}\n`);

    await this.startServices(ports);
  }

  async showPortUsage(conflicts) {
    console.log(
      `${colors.cyan}🔍 Checking what's using the ports...${colors.reset}\n`
    );

    for (const conflict of conflicts) {
      console.log(
        `${colors.yellow}Port ${conflict.port} (${conflict.service}):${colors.reset}`
      );

      try {
        const { exec } = await import("child_process");
        const { promisify } = await import("util");
        const execAsync = promisify(exec);

        const result = await execAsync(`lsof -i :${conflict.port}`);
        console.log(result.stdout);
      } catch (error) {
        console.log(`   Unable to determine what's using this port`);
      }
      console.log("");
    }

    console.log(`${colors.cyan}💡 To free up ports, you can:${colors.reset}`);
    console.log(`   • Stop the conflicting processes`);
    console.log(
      `   • Use: ${colors.bright}lsof -ti:PORT | xargs kill -9${colors.reset}`
    );
    console.log("");
  }

  async startServices(ports) {
    // Update .env file
    updateEnvFile(ports);

    // Read the updated .env file to get all environment variables
    const envPath = path.join(__dirname, "../.env");
    const envFileContent = fs.readFileSync(envPath, 'utf8');
    const envVars = {};
    envFileContent.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        if (key) {
          envVars[key.trim()] = valueParts.join('=').trim();
        }
      }
    });

    await this.ensureLibraryAssets(envVars);

    const services = [
      {
        name: "Asset Service",
        command: "npm",
        args: ["run", "dev"],
        cwd: path.join(__dirname, "../services/asset-service"),
        prefix: "🗂️  [ASSETS]",
        color: colors.blue,
        env: {
          ...envVars,
          PORT: ports.assetService.toString(),
          ASSETS_PATH: path.join(__dirname, "../static-assets"),
          LIBRARY_DATA_PATH: path.join(__dirname, "../assets-data"),
          LIBRARY_MANIFEST_PATH: path.join(
            __dirname,
            "../assets-data/manifests/manifest-v2.json"
          ),
          ASSET_SEED_SOURCE: path.join(__dirname, "../asset-packs/tmt"),
        },
      },
      {
        name: "Backend Server",
        command: "npm",
        args: ["run", "server:dev"],
        cwd: path.join(__dirname, ".."),
        prefix: "🔌 [BACKEND]",
        color: colors.magenta,
        env: {
          ...envVars,  // Pass all env vars from .env file
          PORT: ports.websocket.toString(),
        },
      },
      {
        name: "Frontend",
        command: "npm",
        args: ["run", "dev"],
        cwd: path.join(__dirname, ".."),
        prefix: "🖥️  [FRONTEND]",
        color: colors.cyan,
        env: { PORT: ports.frontend.toString() },
      },
    ];

    // Setup graceful shutdown
    this.setupGracefulShutdown();

    // Start services
    console.log(`${colors.bright}🚀 Starting all services...${colors.reset}\n`);

    for (const service of services) {
      this.startService(service);
      await new Promise((resolve) => setTimeout(resolve, 1000)); // Stagger startup
    }

    // Show success message
    setTimeout(() => {
      console.log(
        `\n${colors.bright}✅ All services started successfully!${colors.reset}`
      );
      console.log(`🌐 Frontend: http://localhost:${ports.frontend}`);
      console.log(`🔌 Backend:  http://localhost:${ports.websocket} (WebSocket + Assets)`);
      console.log(`🗂️  Assets:   http://localhost:${ports.assetService}`);
      console.log(
        `\n${colors.bright}📝 Press Ctrl+C to stop all services${colors.reset}\n`
      );
    }, 3000);
  }

  async ensureLibraryAssets(envVars) {
    const scriptPath = path.join(__dirname, "ensure-library-assets.cjs");
    const sourcePath = path.resolve(
      __dirname,
      "..",
      envVars.ASSET_SEED_SOURCE || "asset-packs/tmt"
    );
    const targetPath = path.resolve(
      __dirname,
      "..",
      envVars.LIBRARY_DATA_PATH || "assets-data"
    );

    console.log(`${colors.cyan}🔍 Checking TMT library asset volume...${colors.reset}`);
    try {
      const { stdout, stderr } = await execFileAsync(process.execPath, [
        scriptPath,
        "--source",
        sourcePath,
        "--target",
        targetPath,
      ]);

      if (stdout.trim()) {
        console.log(`${colors.green}${stdout.trim()}${colors.reset}`);
      }
      if (stderr.trim()) {
        console.log(`${colors.yellow}${stderr.trim()}${colors.reset}`);
      }
    } catch (error) {
      if (error.stdout?.trim()) {
        console.log(error.stdout.trim());
      }
      if (error.stderr?.trim()) {
        console.log(`${colors.red}${error.stderr.trim()}${colors.reset}`);
      }
      throw new Error("TMT library assets are missing or invalid");
    }
  }

  startService(service) {
    console.log(
      `${service.color}🚀 Starting ${service.name}...${colors.reset}`
    );

    const childProcess = spawn(service.command, service.args, {
      cwd: service.cwd,
      stdio: ["pipe", "pipe", "pipe"],
      env: {
        ...process.env,
        ...service.env,
        FORCE_COLOR: "1",
      },
    });

    this.processes.push({ ...service, process: childProcess });

    // Handle stdout
    childProcess.stdout.on("data", (data) => {
      const lines = data
        .toString()
        .split("\n")
        .filter((line) => line.trim());
      lines.forEach((line) => {
        console.log(`${service.color}${service.prefix}${colors.reset} ${line}`);
      });
    });

    // Handle stderr
    childProcess.stderr.on("data", (data) => {
      const lines = data
        .toString()
        .split("\n")
        .filter((line) => line.trim());
      lines.forEach((line) => {
        console.log(`${service.color}${service.prefix}${colors.reset} ${line}`);
      });
    });

    // Handle process exit
    childProcess.on("close", (code) => {
      if (!this.isShuttingDown && code !== 0) {
        console.log(
          `${colors.red}${service.prefix} Process crashed with code ${code}${colors.reset}`
        );
        this.shutdown();
      }
    });

    childProcess.on("error", (error) => {
      console.log(
        `${colors.red}${service.prefix} Error: ${error.message}${colors.reset}`
      );
      this.shutdown();
    });
  }

  setupGracefulShutdown() {
    const shutdown = () => {
      this.shutdown();
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
  }

  shutdown() {
    if (this.isShuttingDown) return;
    this.isShuttingDown = true;

    console.log(
      `\n${colors.bright}🛑 Shutting down all services...${colors.reset}`
    );

    this.processes.forEach(({ name, process, color }) => {
      console.log(`   ${color}Stopping ${name}...${colors.reset}`);
      process.kill("SIGTERM");
    });

    setTimeout(() => {
      process.exit(0);
    }, 3000);
  }
}

// Start the intelligent starter
const starter = new IntelligentStarter();
starter.start();
