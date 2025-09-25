# Plasma Engine Gateway

## Overview

**Plasma Engine Gateway** is the unified API gateway and GraphQL federation layer for the Plasma Engine platform. It provides:

- 🚀 **GraphQL Federation**: Unified API across all services
- 🔐 **Authentication & Authorization**: JWT validation, RBAC, API key management
- 🌐 **Rate Limiting & Throttling**: Per-user and per-IP controls
- 📊 **Request Routing**: Smart routing to backend services
- 🔍 **API Analytics**: Request tracking and performance metrics
- 🛡️ **Security**: CORS, CSP, input validation

## Tech Stack

- **Language**: TypeScript
- **Framework**: Apollo Server 4.x with Federation
- **Gateway**: Apollo Gateway
- **Auth**: Auth0 / Clerk integration
- **Cache**: Redis for session management
- **Monitoring**: OpenTelemetry, Prometheus

## Quick Start

```bash
# Install dependencies
pnpm install

# Set up environment
cp .env.example .env

# Run development server
pnpm dev

# Run tests
pnpm test

# Build for production
pnpm build
```

## Architecture

This service acts as the single entry point for all client applications:

```
Clients → Gateway → [Research|Brand|Content|Agent] Services
```

## Development

See [Development Handbook](../plasma-engine-shared/docs/development-handbook.md) for guidelines.

## CI/CD

This repository uses GitHub Actions for CI/CD. All PRs are automatically:
- Linted and tested
- Security scanned
- Reviewed by CodeRabbit

See `.github/workflows/ci.yml` for details.