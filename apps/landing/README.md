# Landing Page (`apps/landing`)

Next.js App Router marketing site for My BJJ Academy.

## Run

Run `pnpm dev:landing` from the repository root. Analytics is disabled locally unless `NEXT_PUBLIC_GTM_ID` is set.

## Vercel

Set the project's Root Directory to `apps/landing` and leave the dashboard
Install Command override off so the project uses the command in `vercel.json`.
It runs the workspace's pinned pnpm version against the root lockfile.
If the workspace changes its pnpm version, update the install command to match.

## Google Analytics and Tag Manager

The production Vercel build uses the public container ID `GTM-MWPSJKFS`. To test in a preview, set `NEXT_PUBLIC_GTM_ID` for the landing project's Preview environment, preferably to a test container. An explicit empty value disables analytics for that build. The app loads GTM after a visitor accepts analytics cookies. The container handles the GA4 integration with `G-4RYBRZKEM3`.

1. In Google Analytics, check that `G-4RYBRZKEM3` is the web stream for `https://www.mybjjacademy.com.br`. Turn off **Enhanced measurement** in this stream. The site sends its own page views and interaction events.
2. In Tag Manager, open container `GTM-MWPSJKFS` and go to **Admin → Import Container**. Import [gtm-MWPSJKFS.json](analytics/gtm-MWPSJKFS.json) into a workspace using **Merge**. Check that the workspace contains one Google tag for `G-4RYBRZKEM3` and seven GA4 event tags. The import uses placeholder numeric account and container IDs. Tag Manager assigns the destination IDs.
3. In **Preview**, open a landing build with GTM enabled, accept analytics cookies, and check that the Google tag and the corresponding event tags fire in Tag Assistant. Check the events in GA4 **DebugView**. Repeat in a clean browser session and reject analytics. The site should send no Google analytics requests. Once verified, publish the container with **Submit → Publish**.

| GA4 event            | Interaction                                     | Custom parameters                |
| -------------------- | ----------------------------------------------- | -------------------------------- |
| `page_view`          | Home, privacy policy, or terms page             |                                  |
| `signup_click`       | Header or hero signup link to the portal        | `cta_location`                   |
| `login_click`        | Header login link to the portal                 | `cta_location`                   |
| `plan_select`        | Trial, Starter, or Full selection               | `plan`                           |
| `contact_click`      | WhatsApp, email, or Instagram link              | `contact_method`, `cta_location` |
| `feature_tab_select` | Student, teacher, or admin feature tab selected | `audience`                       |
| `faq_open`           | FAQ answer opened                               | `faq_topic`                      |

Register the custom parameters as **event-scoped custom dimensions** in GA4 to use them in reports. Signup, login, and plan events measure link clicks. Completed registrations and purchases are outside the landing measurement scope.
