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

## Student plans and manual payments

Each student has a plan with a `type` (`Mensal`, `Semestral`, `Anual`),
`startDate` (YYYY-MM-DD), and `isActive`. This flag is the student status shown
in the portal. Managers can change it in student editing or student details.
Unpaid periods and payment corrections never change activation automatically.

The details page at `/alunos/[studentId]` displays the student record, plan and
payment history. Periods recur every 1, 6 or 12 months from the start date; month
ends are clamped without accumulating date drift. Payment records are created
only when a manager records them, and retain the plan type and exact period.
Changing a plan preserves old payments. Managers may mark a period paid, correct
its payment date/notes, or mark it pending again. Only admins from the student's
academy can view or change billing records.

Existing records without a plan default to Mensal, active, starting on the first
day of the current Brasília month. After deployment, persist those defaults with:

```sh
pnpm --filter @mybjj/backend exec convex run studentPlans:initializeExistingPlans '{}'
```

Initialization is idempotent, preserves existing plans, and creates no payments.

## Team visibility

Teams created in the portal store `ownerGymId` for the selected academy. Team
queries include both owned teams and the academy's existing `teamId` affiliation.
The first team created for an academy with no affiliation becomes its affiliated
team; later creations preserve that affiliation and remain visible through
ownership. Reads and updates require academy access; creation/updates require
an admin. The internal `teams.recoverUnlinkedTeam` mutation restores a verified
legacy team without replacing another academy's ownership or affiliation.

The portal currently hides team management: `/equipe` redirects to `/academia`.
Academy creation and editing use an optional free-text `teamName` field instead.
Academy queries prefill the existing linked team's name when `teamName` has not
yet been saved; saving an empty value explicitly clears the displayed name.
