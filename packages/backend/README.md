# @mybjj/backend

Convex backend package for MyBJJAcademy.

## Commands

- `pnpm --filter @mybjj/backend dev`: run local Convex dev server
- `pnpm --filter @mybjj/backend codegen`: regenerate Convex API types
- `pnpm --filter @mybjj/backend typecheck`: type-check backend TS files
- `pnpm --filter @mybjj/backend test`: run backend regression tests (Node 22.6+ with built-in TypeScript support)

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

## Student registration

The admin form saves students without app access by default. Email and phone are
optional for these academy records, and no Clerk user or invitation is created.
Checking the account option requires an email and sends a Clerk invitation.
Students without a `clerkUserId` cannot be linked automatically by contact email.
Date of birth is optional for both existing and new students and uses `YYYY-MM-DD`.

The belt options include all twelve youth belts. Teachers additionally support
`GI_NOGI` (GI e NO-GI); individual class templates still use GI or NOGI.

## Portal images

Student/professor photos and academy/team logos use JPG/PNG file inputs with a
2 MB limit. The browser previews the selection and sends Base64 to
`images.uploadBase64` when the form is saved. Only authenticated administrators
can upload. The backend validates MIME type, file signatures, encoding and size,
then decodes the bytes into Convex File Storage.

The `images` table tracks the storage ID, serving URL, original filename, type,
size, uploading user and timestamp. Domain records keep the serving URL in their
existing `picture`, `branding.logoUrl` or `logo` fields. Existing image URLs are
preserved when no new file is selected. Replaced images are retained in storage.

Sync the new schema and functions with `pnpm dev:backend` before using uploads.
