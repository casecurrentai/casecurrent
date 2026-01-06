# CounselTech

AI-powered intake and lead capture platform for law firms.

## Architecture

This is a monorepo containing the following packages:

```
counseltech/
├── apps/
│   ├── api/          # Fastify + TypeScript backend API
│   └── web/          # Next.js + TypeScript frontend
├── packages/
│   ├── shared/       # Shared types and utilities
│   └── config/       # Shared ESLint, Prettier, and TypeScript configs
```

## Tech Stack

- **Backend**: Fastify + TypeScript
- **Frontend**: Next.js 14 (App Router) + TypeScript
- **Database**: PostgreSQL with Prisma ORM (coming soon)
- **Styling**: Tailwind CSS
- **Package Manager**: npm workspaces

## Getting Started

### Prerequisites

- Node.js >= 18.0.0
- npm >= 9.0.0

### Development

Run both the API and web app in development mode:

```bash
# Install dependencies
npm install

# Run all apps
npm run dev

# Or run individually
npm run dev:api    # Fastify API on port 3001
npm run dev:web    # Next.js on port 5000
```

### Project Structure

| Directory | Description |
|-----------|-------------|
| `apps/api` | Fastify REST API server |
| `apps/web` | Next.js frontend application |
| `packages/shared` | Shared TypeScript types and utilities |
| `packages/config` | Shared configuration (ESLint, Prettier, TSConfig) |

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `API_PORT` | Port for the API server | `3001` |
| `DATABASE_URL` | PostgreSQL connection string | - |

## API Documentation

API documentation is available at `/docs` when running the API server (Swagger UI - coming soon).

## Checkpoints

- **cp0-structure**: Initial monorepo structure setup

## License

Proprietary - All rights reserved.
