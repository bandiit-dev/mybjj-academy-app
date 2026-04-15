# MyBJJAcademy Monorepo

Base monorepo scaffold for the **MyBJJAcademy** platform.

This repository includes:

- Convex backend (shared by mobile and admin)
- Expo React Native mobile app
- Next.js landing page
- Next.js admin portal
- Shared TypeScript / lint config packages

## Tech Stack

- pnpm workspaces
- Turborepo
- TypeScript everywhere
- Convex (data + backend functions)
- Clerk (authentication)
- Resend (email utility base)
- Next.js App Router (landing + admin)
- Expo React Native (mobile)

## Monorepo Structure

```text
apps/
  admin/        # Next.js admin portal
  landing/      # Next.js landing page
  mobile/       # Expo React Native app
packages/
  backend/      # Convex backend + Resend utility
  eslint-config/
  shared/
  typescript-config/
```

## Quick Start

1. Install dependencies:

```bash
pnpm install
```

2. Prepare environment files:

- Root: `.env.example`
- Backend: `packages/backend/.env.example`
- Admin: `apps/admin/.env.example`
- Mobile: `apps/mobile/.env.example`
- Landing: `apps/landing/.env.example`

3. Run everything in dev mode:

```bash
pnpm dev
```

Or run targeted apps:

```bash
pnpm dev:backend
pnpm dev:mobile
pnpm dev:admin
pnpm dev:landing
```

## Root Scripts

- `pnpm dev`: run all workspace `dev` tasks via Turbo
- `pnpm build`: run all workspace `build` tasks
- `pnpm lint`: run all workspace `lint` tasks
- `pnpm typecheck`: run all workspace `typecheck` tasks
- `pnpm dev:mobile`: run only mobile app
- `pnpm dev:admin`: run only admin app
- `pnpm dev:landing`: run only landing app
- `pnpm dev:backend`: run only Convex backend

## Convex Backend

Backend source lives in `packages/backend`:

- Schema: `packages/backend/convex/schema.ts`
- Auth helpers: `packages/backend/convex/lib/auth.ts`
- Validators: `packages/backend/convex/lib/validators.ts`
- Domain functions:
  - `packages/backend/convex/gyms.ts`
  - `packages/backend/convex/unities.ts`
  - `packages/backend/convex/teams.ts`
  - `packages/backend/convex/teachers.ts`
  - `packages/backend/convex/students.ts`
  - `packages/backend/convex/classes.ts`

### CRUD Implemented

Create mutations:

- `createGym`
- `createUnity`
- `createTeam`
- `createTeacher`
- `createStudent`
- `createClass`

Update mutations:

- `updateGym`
- `updateUnity`
- `updateTeam`
- `updateTeacher`
- `updateStudent`
- `updateClass`

Get-by-id queries:

- `getGymById`
- `getUnityById`
- `getTeamById`
- `getTeacherById`
- `getStudentById`
- `getClassById`

List queries:

- `getAllGyms`
- `getAllUnities`
- `getAllTeams`
- `getAllTeachers`
- `getAllStudents`
- `getAllClasses`

Current user queries:

- `getCurrentTeacher`
- `getCurrentStudent`

### Authorization Rules

Auth helpers implemented:

- `getAuthUserIdentity`
- `getCurrentTeacherByClerkId`
- `getCurrentStudentByClerkId`
- `requireAdmin`
- `requireTeacherOrAdmin`
- `requireStudentOrAdmin`

Behavior:

- Admin-only create/update for: Gym, Team, Teacher, Unity, Class
- Student creation: allowed for authenticated users to create **their own** student profile; admins can create any student profile
- Teacher update: self basic profile update or admin update for any teacher
- Student update: self basic profile update or admin update for any student
- No delete endpoints yet

## Clerk and Passwords

Clerk is the source of truth for authentication.

- `Teacher` and `Student` records store `clerkUserId`
- Passwords are **not** stored in Convex
- Convex functions derive current identity from Clerk auth subject (`identity.subject`)

This keeps credential handling entirely in Clerk and avoids storing sensitive password material in application tables.

## Environment Variables

### Backend (`packages/backend/.env.example`)

- `CONVEX_URL`
- `CLERK_ISSUER_URL`
- `CLERK_JWKS_URL`
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`

### Mobile (`apps/mobile/.env.example`)

- `EXPO_PUBLIC_CONVEX_URL`
- `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`

### Admin (`apps/admin/.env.example`)

- `NEXT_PUBLIC_CONVEX_URL`
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`

### Landing

No required env variables yet.

## Resend Base Integration

A minimal Resend utility exists at:

- `packages/backend/src/resend.ts`

It exports:

- `getResendClient()`
- `sendSystemEmail(...)`

No notification workflows are wired yet; this is only a reusable integration point.

## What Is Intentionally Left for Later

- Full Clerk sign-in/sign-up UX and session flows in apps
- Convex generated API typing wired across apps
- Advanced form validation and input sanitization
- Business workflows (attendance, billing, notifications orchestration)
- Delete endpoints and soft-delete strategy
- UI design system and production UX polish

## Assumptions Made

- Self-service student creation is allowed for authenticated users, but only for their own `clerkUserId`
- “Basic profile” self-update scope for teachers/students is: `name`, `email`, `phone`, `picture`
- Convex domain modules are separated by entity for maintainability
- Minimal UI scaffolds are preferred over heavy starter templates

## Attendance Model Update (Sessions)

The class attendance model now uses dated sessions and two dedicated records:

- `classSessions`: real class occurrences on a specific date
- `enrollments`: student attendance intent (`Confirmed` / `Cancelled`)
- `attendance`: actual outcome marked by teacher/admin (`Present` / `Absent`)

### Breaking Change

- `classes.studentPresenceIds` was removed.
- `classes` now only represent recurring templates and include `unityIds`.

### Migration Assumption

This repository is currently in bootstrap phase with no production data migration required.
Existing code paths were updated directly to the new model.
