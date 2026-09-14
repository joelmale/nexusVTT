# NexusCodex Documentation

This directory contains the Docusaurus-powered documentation website for NexusCodex, a document library microservice for Virtual Tabletop systems.

## Development

```bash
# Install dependencies
npm install

# Start development server (runs on port 3003 to avoid conflicts with the API)
npm start

# Or specify a custom port
npm start -- --port 3004

# Build for production
npm run build

# Serve built site locally
npm run serve
```

## Content Structure

- `docs/` - Documentation content (migrated from `dev_docs/`)
- `src/pages/` - Custom pages (homepage, etc.)
- `src/components/` - Custom React components
- `static/` - Static assets (images, etc.)

## Configuration

- `docusaurus.config.ts` - Site configuration, navigation, theme
- `sidebars.ts` - Documentation sidebar structure

## Deployment Options

### GitHub Pages

1. Update `organizationName` and `projectName` in `docusaurus.config.ts`
2. Enable GitHub Pages in repository settings
3. Deploy: `npm run deploy`

### Netlify/Vercel

1. Build command: `npm run build`
2. Publish directory: `build/`
3. Deploy the generated static files

### Docker

You can also containerize the docs:

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
EXPOSE 3003
CMD ["npm", "run", "serve", "--", "--port", "3003"]
```

## Contributing

1. Edit documentation files in `docs/`
2. Test locally with `npm start`
3. Ensure links and navigation work correctly
4. Build and verify with `npm run build`
