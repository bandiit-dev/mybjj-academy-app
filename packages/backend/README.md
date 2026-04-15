# @mybjj/backend

Convex backend package for MyBJJAcademy.

## Commands

- `pnpm --filter @mybjj/backend dev`: run local Convex dev server
- `pnpm --filter @mybjj/backend codegen`: regenerate Convex API types
- `pnpm --filter @mybjj/backend typecheck`: type-check backend TS files

## Structure

- `convex/schema.ts`: database schema
- `convex/lib/auth.ts`: auth + authorization helpers
- `convex/lib/validators.ts`: enum and validation helpers
- `convex/classes.ts`: recurring class template CRUD
- `convex/classSessions.ts`: dated session lifecycle + session detail query
- `convex/enrollments.ts`: student enrollment confirmations/cancellations
- `convex/attendance.ts`: attendance marking + attendance queries
- `convex/{gyms,unities,teams,teachers,students}.ts`: existing entity modules
- `src/resend.ts`: base Resend integration utility
