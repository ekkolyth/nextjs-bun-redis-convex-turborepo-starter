This is a [Next.js](https://nextjs.org) monorepo using [Bun](https://bun.sh) as the package manager and [Redis](https://redis.io) for caching.

## Getting Started

### Prerequisites

- [Bun](https://bun.sh/docs/installation) installed
- Redis server running (or Redis URL configured)

### Installation

Install dependencies:

```bash
bun install
```

### Redis Configuration

The project uses `ioredis` (a Node.js Redis client) for Next.js caching. Configure Redis by setting one of these environment variables:

- `REDIS_URL` (preferred)
- `VALKEY_URL`
- Defaults to `redis://localhost:6379` if neither is set

Example `.env.local` in `apps/web/`:

```bash
REDIS_URL=redis://localhost:6379
# For TLS connections:
# REDIS_URL=rediss://localhost:6379
# For authenticated connections:
# REDIS_URL=redis://username:password@localhost:6379
```

### Development

Run the development server:

```bash
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `apps/web/src/app/page.tsx`. The page auto-updates as you edit the file.

## Features

- **Bun**: Fast package manager and runtime
- **Redis Caching**: Custom cache handler using ioredis (Node.js Redis client)
- **Turbo**: Monorepo build system
- **Next.js**: React framework with App Router

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
