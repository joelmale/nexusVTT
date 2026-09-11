#!/usr/bin/env node

/**
 * Health check script for the WebSocket backend
 * Verifies the server is responding to HTTP requests
 */

const http = require('http');

const options = {
  hostname: 'localhost',
  port: 5000,
  path: '/health',
  method: 'GET',
  timeout: 2000
};

const req = http.request(options, (res) => {
  if (res.statusCode === 200) {
    process.exit(0); // Healthy
  } else {
    console.error(`Health check failed with status: ${res.statusCode}`);
    process.exit(1); // Unhealthy
  }
});

req.on('error', (error) => {
  console.error('Health check failed:', error.message);
  process.exit(1); // Unhealthy
});

req.on('timeout', () => {
  console.error('Health check timed out');
  req.destroy();
  process.exit(1); // Unhealthy
});

req.end();
