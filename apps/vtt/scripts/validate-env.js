#!/usr/bin/env node

/**
 * Environment Validation Script for Nexus VTT
 * Validates that all required environment variables are set and valid
 */

import fs from 'fs';
import path from 'path';
import { config } from 'dotenv';

// ANSI color codes for console output
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
  bold: '\x1b[1m',
};

// Required environment variables with validation rules
const requiredVars = [
  {
    name: 'NODE_ENV',
    required: true,
    allowedValues: ['development', 'production', 'test'],
    description: 'Application environment mode',
  },
  {
    name: 'VITE_APP_NAME',
    required: true,
    description: 'Application name displayed in the UI',
  },
  {
    name: 'VITE_WEBSOCKET_URL',
    required: true,
    validate: (value) => {
      return value.startsWith('ws://') || value.startsWith('wss://');
    },
    description: 'WebSocket server URL for real-time features',
  },
  {
    name: 'VITE_API_BASE_URL',
    required: true,
    validate: (value) => {
      try {
        new URL(value);
        return true;
      } catch {
        return false;
      }
    },
    description: 'Base URL for API endpoints',
  },
  {
    name: 'VITE_ASSET_SERVER_URL',
    required: true,
    validate: (value) => {
      try {
        new URL(value);
        return true;
      } catch {
        return false;
      }
    },
    description: 'Asset server URL for game resources',
  },
  {
    name: 'PORT',
    required: false,
    validate: (value) => {
      const port = parseInt(value, 10);
      return port > 0 && port <= 65535;
    },
    description: 'Server port number',
    defaultValue: '3000',
  },
  {
    name: 'ASSET_PORT',
    required: false,
    validate: (value) => {
      const port = parseInt(value, 10);
      return port > 0 && port <= 65535;
    },
    description: 'Asset server port number',
    defaultValue: '3001',
  },
  {
    name: 'REDIS_URL',
    required: false,
    validate: (value) => {
      return value.startsWith('redis://') || value.startsWith('rediss://');
    },
    description: 'Redis connection URL for pub/sub',
    defaultValue: 'redis://localhost:6379',
  },
];

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function logError(message) {
  log(`❌ ${message}`, colors.red);
}

function logSuccess(message) {
  log(`✅ ${message}`, colors.green);
}

function logWarning(message) {
  log(`⚠️  ${message}`, colors.yellow);
}

function logInfo(message) {
  log(`ℹ️  ${message}`, colors.blue);
}

function validateEnvironment() {
  log(`${colors.bold}🔍 Validating Environment Configuration${colors.reset}\n`);

  // Load environment variables
  config();

  let hasErrors = false;
  let hasWarnings = false;

  // Check each required variable
  for (const varConfig of requiredVars) {
    const value = process.env[varConfig.name];

    if (!value) {
      if (varConfig.required) {
        logError(`Missing required environment variable: ${varConfig.name}`);
        logInfo(`  Description: ${varConfig.description}`);
        if (varConfig.defaultValue) {
          logInfo(`  Default value: ${varConfig.defaultValue}`);
        }
        hasErrors = true;
      } else {
        logWarning(`Optional environment variable not set: ${varConfig.name}`);
        logInfo(`  Description: ${varConfig.description}`);
        if (varConfig.defaultValue) {
          logInfo(`  Default value: ${varConfig.defaultValue}`);
        }
        hasWarnings = true;
      }
      continue;
    }

    // Validate allowed values
    if (varConfig.allowedValues && !varConfig.allowedValues.includes(value)) {
      logError(`Invalid value for ${varConfig.name}: ${value}`);
      logInfo(`  Allowed values: ${varConfig.allowedValues.join(', ')}`);
      hasErrors = true;
      continue;
    }

    // Custom validation
    if (varConfig.validate && !varConfig.validate(value)) {
      logError(`Invalid format for ${varConfig.name}: ${value}`);
      logInfo(`  Description: ${varConfig.description}`);
      hasErrors = true;
      continue;
    }

    logSuccess(`${varConfig.name}: ${value}`);
  }

  // Check for .env file
  const envPath = path.join(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) {
    logWarning('No .env file found');
    logInfo('  Copy .env.example to .env and configure your environment variables');
    hasWarnings = true;
  }

  // Summary
  console.log('');
  if (hasErrors) {
    logError('❌ Environment validation failed!');
    logInfo('Please fix the errors above before running the application.');
    process.exit(1);
  } else if (hasWarnings) {
    logWarning('⚠️  Environment validation completed with warnings');
    logInfo('The application should work, but some features may not be optimal.');
  } else {
    logSuccess('✅ Environment validation passed!');
    logInfo('All required environment variables are set and valid.');
  }
}

// Additional utility functions
function showEnvTemplate() {
  log(`${colors.bold}📋 Environment Template${colors.reset}\n`);

  requiredVars.forEach((varConfig) => {
    const example = varConfig.defaultValue ||
      (varConfig.allowedValues ? varConfig.allowedValues[0] : 'your_value_here');

    log(`# ${varConfig.description}`);
    if (varConfig.allowedValues) {
      log(`# Allowed values: ${varConfig.allowedValues.join(', ')}`);
    }
    log(`${varConfig.name}=${example}`);
    log('');
  });
}

// CLI handling
const command = process.argv[2];

switch (command) {
  case 'validate':
  case undefined:
    validateEnvironment();
    break;
  case 'template':
    showEnvTemplate();
    break;
  case 'help':
    log(`${colors.bold}Environment Validation Script${colors.reset}`);
    log('');
    log('Usage:');
    log('  npm run validate-env           Validate current environment');
    log('  npm run validate-env template  Show environment template');
    log('  npm run validate-env help      Show this help message');
    break;
  default:
    logError(`Unknown command: ${command}`);
    log('Run "npm run validate-env help" for usage information');
    process.exit(1);
}