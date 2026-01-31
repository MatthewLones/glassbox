# GlassBox V2 Frontend Documentation

Welcome to the GlassBox V2 frontend documentation. This guide covers the complete implementation of the Next.js-based frontend application, including real-time collaboration, four visualization modes, and agent execution UI.

## Quick Reference

| Component | Location |
|-----------|----------|
| Web App | `apps/web/` |
| Components | `apps/web/src/components/` |
| Hooks | `apps/web/src/hooks/` |
| Stores | `apps/web/src/stores/` |
| API Client | `apps/web/src/lib/api.ts` |
| WebSocket | `apps/web/src/lib/websocket/` |
| Auth | `apps/web/src/lib/auth/` |
| Routes | `apps/web/src/app/` |
| Shared Types | `packages/shared-types/` |

---

## Documentation Index

### Core Documentation

| Document | Description |
|----------|-------------|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | System design, component hierarchy, data flow patterns |
| [COMPONENTS.md](./COMPONENTS.md) | All UI components with props and usage examples |
| [HOOKS.md](./HOOKS.md) | Custom React hooks for data fetching and features |
| [STATE.md](./STATE.md) | Zustand stores and React Query integration |

### Infrastructure

| Document | Description |
|----------|-------------|
| [AUTHENTICATION.md](./AUTHENTICATION.md) | Auth flow, Cognito config, protected routes |
| [API_CLIENT.md](./API_CLIENT.md) | REST API client and endpoint documentation |
| [WEBSOCKET.md](./WEBSOCKET.md) | Real-time communication, presence, locks |
| [VIEWS.md](./VIEWS.md) | Tree, Canvas, Graph, Grid view implementations |

---

## Technology Stack

```
┌─────────────────────────────────────────────────────────────────┐
│                     GlassBox V2 Frontend                         │
├─────────────────────────────────────────────────────────────────┤
│  Framework     │  Next.js 14 (App Router) + React 18 + TS       │
├─────────────────────────────────────────────────────────────────┤
│  Styling       │  Tailwind CSS 3.4 + Shadcn/ui + Lucide Icons   │
├─────────────────────────────────────────────────────────────────┤
│  State         │  Zustand (global) + React Query (server)       │
├─────────────────────────────────────────────────────────────────┤
│  Visualization │  ReactFlow 11 (canvas) + D3 Force (graph)      │
├─────────────────────────────────────────────────────────────────┤
│  Real-time     │  WebSocket (presence, locks, live updates)     │
├─────────────────────────────────────────────────────────────────┤
│  Auth          │  AWS Cognito (OAuth) + Dev Mode fallback       │
├─────────────────────────────────────────────────────────────────┤
│  Testing       │  Vitest + Testing Library (83 tests)           │
└─────────────────────────────────────────────────────────────────┘
```

---

## Directory Structure

```
apps/web/src/
├── app/                          # Next.js App Router
│   ├── api/auth/                 # Auth API routes
│   ├── auth/                     # Login/logout/callback pages
│   ├── dashboard/                # Dashboard page
│   ├── projects/[projectId]/     # Project workspace
│   ├── showcase/                 # Component showcase
│   ├── layout.tsx                # Root layout
│   ├── page.tsx                  # Landing page
│   └── providers.tsx             # App providers
│
├── components/                   # React components (118 files)
│   ├── ui/                       # Shadcn/ui primitives
│   ├── layout/                   # AppShell, Header, Sidebar
│   ├── canvas/                   # ReactFlow canvas view
│   ├── graph/                    # D3 force graph view
│   ├── tree/                     # Hierarchical tree view
│   ├── grid/                     # Folder-style grid view
│   ├── node/                     # Node components & forms
│   ├── agent/                    # Execution & HITL
│   ├── presence/                 # User presence avatars
│   ├── lock/                     # Node locking UI
│   ├── search/                   # Cmd+K command palette
│   ├── notifications/            # Notification bell & panel
│   └── ...                       # Other categories
│
├── hooks/                        # Custom React hooks
│   ├── use-nodes.ts              # Node CRUD hooks
│   ├── use-projects.ts           # Project hooks
│   ├── use-execution.ts          # Agent execution
│   ├── use-search.ts             # Search functionality
│   ├── use-notifications.ts      # Notifications
│   └── use-file-upload.ts        # S3 file upload
│
├── stores/                       # Zustand stores
│   ├── app-store.ts              # Global app state
│   ├── canvas-store.ts           # Canvas-specific state
│   └── execution-store.ts        # Execution & HITL state
│
├── lib/                          # Utility libraries
│   ├── api.ts                    # REST API client
│   ├── auth/                     # Auth context & config
│   ├── websocket/                # WebSocket client & hooks
│   ├── canvas/                   # Canvas utilities
│   ├── graph/                    # Force layout utilities
│   └── utils.ts                  # General utilities
│
└── middleware.ts                 # Next.js auth middleware
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm 8+

### Development Setup

```bash
# From repository root
cd apps/web

# Install dependencies
pnpm install

# Start development server
pnpm dev

# Run tests
pnpm test

# Build for production
pnpm build
```

### Development Login

In development mode (when Cognito is not configured), use the dev login page:

1. Navigate to `http://localhost:3000/auth/dev-login`
2. Select a preset user or create custom credentials
3. Click "Login" to receive a mock JWT

---

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NEXT_PUBLIC_API_URL` | Backend API base URL | `http://localhost:8080` |
| `NEXT_PUBLIC_WS_URL` | WebSocket server URL | (derived from API_URL) |
| `NEXT_PUBLIC_COGNITO_REGION` | AWS Cognito region | `us-east-1` |
| `NEXT_PUBLIC_COGNITO_USER_POOL_ID` | Cognito User Pool ID | - |
| `NEXT_PUBLIC_COGNITO_CLIENT_ID` | Cognito App Client ID | - |
| `NEXT_PUBLIC_COGNITO_DOMAIN` | Cognito hosted UI domain | - |

---

## Key Features

### Four Visualization Modes
- **Tree View** - Hierarchical file explorer style
- **Canvas View** - ReactFlow-based node graph editor (primary)
- **Graph View** - D3 force-directed dependency visualization
- **Grid View** - Folder-style card layout

### Real-Time Collaboration
- **Presence Tracking** - See who's viewing/editing nodes
- **Node Locking** - Prevent concurrent editing conflicts
- **Live Updates** - Real-time node create/update/delete

### Agent Execution
- **Execution Panel** - Start, pause, resume, cancel agents
- **Trace Timeline** - View execution history and events
- **HITL Modal** - Human-in-the-loop intervention requests

### Search
- **Cmd+K** - Global command palette
- **Full-text Search** - Search across all content
- **Semantic Search** - AI-powered similarity search

---

## Related Documentation

- [V1 Backend Documentation](../v1/) - API, Database, Infrastructure
- [PRD](../PRD.md) - Product Requirements
- [TECHNICAL.md](../TECHNICAL.md) - Technical Specification
- [CHANGELOG.md](../CHANGELOG.md) - Development History
