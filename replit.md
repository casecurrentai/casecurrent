# CounselTech

AI-powered intake and lead capture platform for law firms.

## Overview

CounselTech is a production-grade MVP that captures inbound phone/SMS/web leads, creates structured intakes, runs qualification scoring, sends notifications, and emits outbound webhooks. The platform includes "self-improving" capabilities with an experimentation engine (A/B testing) for intake scripts and explainable scoring stored in qualification reasons.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

- **Framework**: Dual frontend setup with Vite + React (primary client in `/client`) and Next.js 14 App Router (`/apps/web`)
- **UI Components**: shadcn/ui component library with Radix UI primitives
- **Styling**: Tailwind CSS with custom design tokens matching CounselTech.net branding
- **State Management**: TanStack React Query for server state
- **Routing**: Wouter for the Vite client, Next.js App Router for the web app
- **Design System**: Custom design guidelines with guilloche underlays, wireframe AI blueprint elements, and specific typography/spacing requirements

### Backend Architecture

- **Framework**: Express.js with TypeScript (primary server in `/server`), with Fastify setup in `/apps/api`
- **API Structure**: REST API with routes prefixed under `/api`
- **Build System**: esbuild for server bundling, Vite for client
- **Development**: tsx for TypeScript execution in development

### Data Storage

- **Database**: PostgreSQL with Drizzle ORM
- **Schema Location**: `/shared/schema.ts` contains database table definitions
- **Migrations**: Drizzle Kit for database migrations (`/migrations` directory)
- **In-Memory Fallback**: MemStorage class for development without database

### Authentication & Authorization

- **Planned RBAC**: Minimal role-based access control for single organization MVP
- **Roles**: owner, admin, staff, viewer
- **Session Management**: Express session with connect-pg-simple for PostgreSQL session storage

### Monorepo Structure

```
counseltech/
├── client/           # Vite + React primary frontend
├── server/           # Express.js backend API
├── shared/           # Shared types, schemas, and utilities
├── apps/
│   ├── api/          # Fastify API (alternative backend)
│   └── web/          # Next.js frontend (alternative)
├── packages/
│   ├── shared/       # Shared package for monorepo
│   └── config/       # ESLint, Prettier, TypeScript configs
```

## External Dependencies

### Database
- PostgreSQL (requires `DATABASE_URL` environment variable)
- Drizzle ORM for type-safe database queries
- drizzle-zod for schema validation

### UI/Frontend Libraries
- Radix UI primitives (dialogs, menus, forms, etc.)
- Tailwind CSS with class-variance-authority
- Lucide React for icons
- react-day-picker for calendar components
- embla-carousel-react for carousels
- recharts for charts
- vaul for drawer components

### API/Backend Libraries
- Express.js with CORS support
- Fastify with Swagger documentation
- Zod for runtime validation
- Passport.js for authentication (planned)

### Development Tools
- TypeScript with strict mode
- ESLint with TypeScript plugin
- Prettier for code formatting
- tsx for TypeScript execution
- Vite with HMR for development

### Replit-Specific
- @replit/vite-plugin-runtime-error-modal
- @replit/vite-plugin-cartographer
- @replit/vite-plugin-dev-banner