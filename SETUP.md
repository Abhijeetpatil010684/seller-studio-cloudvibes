# CloudVibes React setup — follow in order

This package extends Abhijeetpatil010684/seller-studio-cloudvibes. Use the existing Cloudflare Pages project and existing GitHub repository. It is not yet deployed. No database or authentication account has been created by this package.

## 1. Put the code in GitHub

Extract this package into a local checkout of the existing repository. Replace the matching files; keep the supplied folders at the repository root. Commit package-lock.json, src/, public/, functions/, schema.sql, index.html and package.json. Do not upload node_modules/, dist/, .dev.vars or credentials.

For a local check, install Node.js 22 or later and run:

```sh
npm ci
npm test
npm run build
```

Push a review branch first. Confirm steps 2–5 before merging into main, since the existing Pages project automatically deploys main. Keep the prior deployment available for rollback. Existing browser-only inventory is not imported; this app starts from the empty D1 state. The old HTML is retained as legacy-index.html in source, not served in the React build.

## 2. Create the empty D1 database

In Cloudflare, open Storage & databases → D1 (dashboard labels may vary), create `cloudvibes-inventory`. Open its SQL console and execute the complete contents of `schema.sql`. It creates one application-state record containing empty products, purchases, sales, stock adjustments and expenses. Running it again does not erase existing data.

This first small-shop version stores a revision-controlled JSON document inside D1. All writes compare revisions atomically to prevent one browser overwriting another. A larger shop should migrate to separate transactional tables rather than grow this record indefinitely. The API limits saves to approximately 2 MB. Tax accounting, automatic Amazon fee retrieval, payment checkout and historical HTML-data import are not implemented.

## 3. Create the product-photo bucket

Create a private R2 bucket named `cloudvibes-images`. Keep public bucket access disabled; the app serves photos through its image API. R2 account activation may require a billing method. The application accepts JPG, PNG and WebP up to 5 MB. Only upload photographs suitable for public viewing. Uploaded photos are publicly reachable by their image URL; hiding a product hides its catalogue listing, not the underlying photo URL.

## 4. Protect inventory login with Cloudflare Access

Open Cloudflare Zero Trust and configure an organisation/team domain. Enable One-time PIN as a login method, or use your existing identity provider. Choose the administrator email(s).

Create ONE self-hosted Access application covering these paths on your actual site hostname:

- `/admin` (includes its child paths)
- `/api/admin` (includes its child paths)

Add both path entries to the SAME application so they share one Application Audience (AUD). Add an Allow policy for only the administrator email address(es). Do not protect the whole site: `/`, `/api/catalogue` and `/api/images/*` must stay public. Do not create a Bypass policy for admin.

If you use a custom domain and the pages.dev hostname, protect both sets of admin paths in this same application, or redirect the alternate hostname to the canonical hostname. API JWT verification also rejects calls without a valid token on alternate deployment URLs. Configure preview access separately; do not expose a test admin to public visitors.

Copy the team URL (e.g. `https://your-team.cloudflareaccess.com`) and the Application Audience (AUD). These are configuration identifiers, not passwords. The backend cryptographically validates the token and checks the administrator email allowlist; hiding the admin link is not the security mechanism.

## 5. Configure the existing Cloudflare Pages project

In Workers & Pages, open your EXISTING Pages project connected to the GitHub repository.

Build settings:

| Setting | Value |
| --- | --- |
| Production branch | main |
| Framework | React (Vite), or None with the settings below |
| Build command | npm run build |
| Build output directory | dist |
| Root directory | blank |
| NODE_VERSION | 22 |

Add Production bindings in Settings → Bindings:

| Binding name | Type | Resource |
| --- | --- | --- |
| DB | D1 database | cloudvibes-inventory |
| IMAGES | R2 bucket | cloudvibes-images |

Add Production environment variables:

| Variable | Value |
| --- | --- |
| ACCESS_TEAM_DOMAIN | full https://your-team.cloudflareaccess.com URL |
| ACCESS_AUD | application audience copied in step 4 |
| ADMIN_EMAILS | administrator email; comma-separated for multiple admins |

Never prefix these with VITE_. Nothing secret should be shipped in the browser bundle. Use separate D1/R2 resources and Access configuration for previews. Bindings must exist for the deployment being tested. A redeploy is needed after changing bindings or runtime variables.

## 6. Merge and verify deployment

Merge the review branch to main after configuration. Wait for the Pages build and Functions deployment to succeed. Inspect the deployment log. Use Git-connected deployment; dragging only the dist folder into Pages does not supply the source Functions workflow documented here.

Acceptance checks:

1. In a private/incognito window, `/` opens without login and shows an empty catalogue.
2. `/admin` asks you to sign in; an unapproved email is denied.
3. An unauthenticated request to `/api/admin/state` cannot return inventory data or accept writes. Before Access is configured the API fails closed with 503/401, never falls back to public editing.
4. Add a packaging item (e.g. box, quantity 10, cost 20).
5. Add one product (e.g. bangles, quantity 5, cost 100, selling price 250), choose Jewellery → Bangles, upload a photo and select one box per unit.
6. Tick Show on customer website. Reload the public catalogue: it shows the product without cost, profit or exact inventory quantity.
7. Record a two-unit sale with actual charges. Product balance becomes 3 and box balance 8. Reload admin: both persist.
8. Return one resellable unit: product balance becomes 4. Used packaging remains spent. Record refunded fees and return charges only when applicable.
9. Cancel an unshipped sale: product and unused packaging restore once. Dispatched orders use Return instead.
10. Open admin in two tabs. Save in one, then save from the stale tab: the second save should report a conflict. Copy its unsaved details, close the form, reload saved data and re-enter them.
11. Set the shop name and your WhatsApp number with country code in Settings. Enquiry buttons open WhatsApp with the chosen product. No online payment or checkout is implemented.
12. Download a backup in Settings after your first successful entries.

## 7. Daily use

Public website: `https://YOUR-SITE/`
Inventory: `https://YOUR-SITE/admin`

Add products and packaging one by one. Prices and stock are calculated from saved purchases and sales. Editing a product cannot rewrite historical purchase costs or change its stock directly; record new purchases or stock losses. Sale prices are editable. Platform fees, taxes embedded in prices and delivery charges must be entered according to your actual records. This is an operational profit tracker, not a tax return or statutory accounting system.

Current cost convention: moving weighted-average cost of remaining inventory. Recorded order costs are frozen. Resellable returns restore historical product value; damaged returns retain the product loss. Stock damage and business expenses reduce net profit. Order revenue is recorded when the sale is created; dispatch/delivery stages track fulfilment rather than accounting revenue recognition.

Cloudflare references:
- https://developers.cloudflare.com/pages/framework-guides/deploy-a-react-site/
- https://developers.cloudflare.com/pages/functions/bindings/
- https://developers.cloudflare.com/cloudflare-one/access-controls/policies/app-paths/
- https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/
