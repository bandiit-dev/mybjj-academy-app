# Landing Page (`apps/landing`)

Minimal Next.js App Router marketing scaffold with:

- Hero
- Features placeholder
- CTA placeholder

## Run

1. Copy `.env.example` to `.env.local` if needed.
2. Run `pnpm dev:landing` from repository root.

## Vercel

Set the project's Root Directory to `apps/landing` and leave the dashboard
Install Command override off so the project uses the command in `vercel.json`.
It runs the workspace's pinned pnpm version against the root lockfile.
If the workspace changes its pnpm version, update the install command to match.
