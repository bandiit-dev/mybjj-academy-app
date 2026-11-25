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

## Demo Seed (Test Data + Test Profiles)

Convex includes an idempotent seed mutation at:

- `packages/backend/convex/seeds.ts` (`seedDemoData`)

This mutation creates:

- 1 team
- 1 gym + 1 unity
- 2 teachers (one admin)
- 1 student
- 1 class template
- 2 class sessions
- enrollment + attendance sample records

This internal mutation is available through the Convex CLI or dashboard. It requires `SEED_SECRET` on the development deployment.

### Seed Env

Set `SEED_SECRET` on your development deployment through the Convex dashboard. Leave it unset in production.

### Seed Command

From repo root:

```bash
pnpm --filter @mybjj/backend exec convex run seeds:seedDemoData '{"secret":"your_local_seed_secret","adminClerkUserId":"user_xxx_admin","teacherClerkUserId":"user_xxx_teacher","studentClerkUserId":"user_xxx_student"}'
```

Notes:

- Use real Clerk User IDs so login maps to existing Convex `teacher` / `student` records.
- If you omit IDs, defaults like `user_test_admin` are used.

## Clerk and Passwords

Clerk is the source of truth for authentication.

- `Teacher` and `Student` records store `clerkUserId`
- Passwords are **not** stored in Convex
- Convex functions derive current identity from Clerk auth subject (`identity.subject`)

This keeps credential handling entirely in Clerk and avoids storing sensitive password material in application tables.

## Account Handling (Current Project)

Current behavior is split between Clerk and Convex:

1. Clerk owns credentials and sessions.
2. Convex stores only profile/domain records (`teachers`, `students`) linked by `clerkUserId`.
3. Authorization in Convex checks current Clerk identity (`identity.subject`) and compares it with `clerkUserId`.
4. Admin capabilities come from `userType === "Admin"` on the matched teacher/student profile.

Practical user lifecycle:

1. Create user in Clerk (admin panel or invite flow).
2. Create matching teacher/student profile in Convex with the same Clerk user ID.
3. User signs in on mobile/admin through Clerk.
4. App queries `getCurrentTeacher` / `getCurrentStudent` to resolve app role and access.

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
- `CONVEX_SITE_URL` (optional override for the Convex HTTP actions origin when using a custom or self-hosted URL)

### Migrating existing student photos

After deploying the Convex schema and admin portal, run `studentPhotos:migrateLegacyPhotos` on the same Convex deployment with `{}`. If the result includes `nextCursor`, run it again with `{"cursor":"<nextCursor>"}` until `nextCursor` is `null`.

The migration copies existing Convex uploads into private storage references and revokes their original download URLs by deleting the old files. Review `unresolved` for external or missing images that need to be uploaded again and for images still used as teacher photos or logos. Remove those public references before rerunning the migration to revoke the old URLs. Legacy URLs are hidden from the portal throughout the migration.

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
