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

## Dashboard monthly presence

`enrollments.getMonthlyPresence` accepts a `YYYY-MM` month and counts confirmed
student/session enrollments for classes dated within that month, including future
classes in the month. It excludes cancelled classes, cancelled enrollments,
deleted students and records outside the admin's academies. One student counts
once per class session; `studentCount` counts distinct enrolled students. This is
an enrollment-based summary, separate from teacher-marked attendance records.

## Portal subscription (Stripe)

The portal costs **R$39.90 per academy per month**. Clerk remains responsible for
sign-in/sign-up. Signed-in administrators without a paid period go to
`/assinatura`. New owners pay before academy setup; setup atomically attaches the
paid billing account to the academy. Other admins of that academy share its
access, while only the billing owner can open Checkout or the customer portal.
The academy details page includes the subscription tile.

This is separate from the student plans and manually recorded student payments.
Eligible owners can start a one-time 7-day Starter trial without a card.

### Stripe and deployment setup

1. In Stripe test mode, create a product with one recurring monthly price:
   **BRL 39.90**, quantity 1. Save its `price_...` ID. Also set an active
   **BRL 99.90/month** price as the default price on the Full product. Stripe
   Checkout adds the seven-day trial to Starter when that option is selected.
2. Set these **Convex deployment environment variables** in the Convex dashboard:
   - `STRIPE_SECRET_KEY`: Stripe test secret key (live key at launch).
   - `STRIPE_MONTHLY_PRICE_ID`: the monthly price ID from step 1.
   - `STRIPE_FULL_PRODUCT_ID` (optional): defaults to `prod_Veu8nfnXHEiuWY`.
     Set this on any deployment using a different Full product, such as your
     Stripe test environment. Use the `prod_...` ID for this specific variable.
   - `APP_URL`: the admin origin for that deployment. Use `http://localhost:3000`
     on the Convex development deployment when testing locally; use
     `https://admin.mybjjacademy.com.br` on production.
   - `STRIPE_WEBHOOK_SECRET`: signing secret for the endpoint below.
   These are backend values; do not add them to `NEXT_PUBLIC_*` or commit them.
   Separate test/live Stripe resources and secrets must match each deployment.
3. Deploy the Convex functions (`pnpm --filter @mybjj/backend exec convex deploy`
   for production), then create a Stripe webhook endpoint:
   `https://<deployment>.convex.site/stripe/webhook`.
   Use the Convex **HTTP Actions URL**, rather than the `.convex.cloud` client URL.
   Select API version `2026-10-28.endive` and these events:
   - `checkout.session.completed`, `checkout.session.async_payment_succeeded`
   - `invoice.paid`, `invoice.payment_failed`, `invoice.payment_action_required`
   - `customer.subscription.created`, `customer.subscription.updated`,
     `customer.subscription.deleted`, `customer.subscription.paused`,
     `customer.subscription.resumed`
   Copy this endpoint's signing secret into `STRIPE_WEBHOOK_SECRET`.
4. Enable Stripe's customer portal with invoice history, payment method updates,
   and cancellation **at the end of the paid period**. Disable plan/quantity
   changes so selections and trial eligibility are handled by the app. Checkout currently
   filters eligible methods to cards using `allowed_payment_method_types`. Enable
   cards in the Stripe Dashboard payment-method settings. The pinned API version
   no longer accepts the legacy `payment_method_types` request parameter.
   Configure failed-payment recovery to cancel unpaid subscriptions
   after retries are exhausted.
5. Deploy the admin app. Its existing Clerk and Convex environment variables are
   sufficient; no new Stripe variable is required in Vercel. The backend's
   `APP_URL` must match the deployment you are testing.
6. Complete a test checkout with a new Clerk signup. Verify academy setup then
   dashboard access, the academy subscription tile and customer portal, a failed
   renewal, recovery, cancellation and expiry. Test both paid tiers and verify
   that a card-free trial expires without a charge. In Stripe, resend a webhook to
   verify duplicate delivery. Repeat in live mode before public launch.

### Access and synchronization

`billingAccounts` stores owner, academy, Stripe customer/subscription/checkout IDs,
status, price, paid-through date, renewal date and cancellation scheduling.
`billingEvents` deduplicates verified webhook deliveries. Payment cards are handled
by Stripe; the application stores no card numbers.

The HTTP action verifies the raw request's HMAC signature and timestamp, then
retrieves the current subscription and latest invoice from Stripe. The paid invoice
must belong to that subscription and match the verified Starter or Full BRL monthly price.
Checkout return verification makes the same server-side checks. A success URL or
browser-supplied flag alone never unlocks access. Out-of-order events cannot
restore a terminated subscription. The Checkout lock, saved session reuse and
Stripe idempotency keys reduce duplicate checkout creation.

An `active` (or retrying `past_due`) subscription grants access only until its
verified paid-through timestamp. Failed renewals do not extend that date.
Scheduled cancellation preserves the paid remainder; terminal cancellation,
`unpaid`, paused and invalid-plan states block access. A verified Starter
trial grants access through Stripe's trial end timestamp. Stripe cancels the
card-free subscription when the trial ends without a payment method, and the
owner can then select a paid plan. The trial allows 25 active students, Starter
allows 50, and Full has no active-student limit. Administrators'
backend domain operations enforce the paid academy scope; the UI refreshes its
access check every 30 seconds. Billing routes remain available for recovery.
Regular student/teacher mobile access retains its existing role rules.

Missing Stripe configuration shows a payment-unavailable message and keeps the
portal blocked. Automated tests mock Stripe and verify signatures, paid invoice
checks, ownership, expiry, renewal failure, duplicate/out-of-order events, checkout
session reuse and paid academy onboarding. They do not perform real charges.


### Subscription coupons

Create a coupon and a customer-facing **promotion code** in the same Stripe
account and test/live mode as the configured monthly price. Owners can enter
that code on `/assinatura`; the server resolves it against active Stripe promotion
codes and passes the promotion ID to Checkout. Customer restrictions, expiry and
redemption limits are respected; Stripe enforces the discount's remaining rules
and shows the final price before confirmation. The code is not a `coupon_` or
`promo_` resource ID. Without a code on the portal page, Stripe Checkout also
allows promotion code entry.

Checkout sessions created before coupon support, or with a different selected
code or a different return origin, are expired and replaced. Discounts do not change the base monthly price
or grant portal access before Stripe confirms a settled invoice, including a
zero-total invoice from a full discount. Coupon duration determines later charges.
