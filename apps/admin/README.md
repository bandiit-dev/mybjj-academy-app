# Admin Portal (`apps/admin`)

Next.js App Router scaffold for internal management.

Includes:

- Clerk provider scaffold
- Convex client provider
- Minimal home page with a sample query card

## Run

1. Copy `.env.example` to `.env.local`.
2. Fill `NEXT_PUBLIC_CONVEX_URL`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, and `CLERK_SECRET_KEY`.
3. Run `pnpm dev:admin` from repository root.

## Authentication URLs

The public `/` route shows the branded, embedded login when signed out and the
admin dashboard after Clerk and Convex authentication and academy access checks
complete. The embedded sign-in/sign-up flow uses hash routing, so it does not need
a dedicated `/sign-in` page. Middleware explicitly redirects unauthenticated
protected-page requests to `/` on the same origin. `/sign-in` and `/sign-up`
bookmarks redirect to `/` while preserving invitation query parameters. Logout
and newly created invitations also return to `/`.

The provider and middleware set both Clerk sign-in and sign-up URLs to `/`.
The matching environment defaults are listed in `.env.example`. Existing team,
student, teacher and academy role checks remain enforced by the access gate and
Convex backend.

To run routing regression tests, start a local app with
`pnpm --filter @mybjj/admin exec next dev --port 3010`, then run
`pnpm --filter @mybjj/admin test:auth`. `AUTH_TEST_BASE_URL` can select another
local port. These tests do not create accounts or send invitations.
