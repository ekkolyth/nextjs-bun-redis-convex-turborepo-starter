## Prerequisites

- [Bun](https://bun.sh/docs/installation) installed
- Docker (for Redis)

## Setup

```bash
# Install dependencies
bun install

# Start development server & redis
make dev
```

Open [http://localhost:3000](http://localhost:3000)

## Redis Configuration

Defaults to `redis://localhost:6379`. To override, set `REDIS_URL` in `apps/web/.env.local`:

```bash
REDIS_URL=redis://localhost:6379
```

## Common Commands

```bash
make dev           # Start Redis and dev server
make redis/up      # Start Redis
make redis/down    # Stop Redis
make redis/status  # Check Redis status
make clean/next    # Clear Next.js cache
```
