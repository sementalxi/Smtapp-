# BannerForge — AI sports banner generator

Users upload a player photo, type their gamertag / team / position (or a roster for a champions poster), and get a 1080×1350 banner with an AI-painted background and an auto-cut-out player. They can then tweak it for free and download a PNG. Generations cost credits, bought as packs or a monthly subscription through Stripe. Admins manage users, credits, templates and settings.

Spanish and English are built in (switch with the ES/EN button in the header).

---

## What's inside

| Area | Where |
|---|---|
| Landing page, styles gallery, pricing | `src/app/page.tsx`, `src/app/pricing` |
| Sign up / log in (email + password) | `src/app/login`, `src/app/register`, `src/app/api/auth/*` |
| Banner creator (pick style → upload → generate) | `src/app/create`, `src/components/CreateForm.tsx` |
| Editor (move/resize player, text, effects, new background, download) | `src/app/banner/[id]`, `src/components/BannerEditor.tsx` |
| Banner renderer (canvas, all layers/effects) | `src/lib/render/renderer.ts` |
| AI (background generation + background removal) | `src/lib/ai.ts` |
| Credits ledger (atomic, refunds on failure) | `src/lib/credits.ts` |
| Stripe checkout, portal, webhook | `src/app/api/stripe/*` |
| Prices of packs & plans | `src/lib/pricing.ts` |
| Admin panel | `src/app/admin/*` |
| Default templates (8 styles) | `src/lib/templates.ts` → seeded into the DB |
| Translations | `src/i18n/dict.ts` |

**How a generation works**

1. The user uploads a photo (downscaled in the browser) and an optional team logo.
2. On *Generate*, the server takes the credits, then in parallel:
   - removes the photo's background (Replicate, `851-labs/background-remover` by default),
   - paints a background from the template's prompt (Replicate `flux-schnell` by default, or OpenAI `gpt-image-1`).
3. The browser composes the final poster on a canvas: color grade, giant background text, the big faded "ghost" portrait, the player with rim glow, particles, logo, name, position tag, script subtitle and footer.
4. Everything after that is free: editing text, moving the player, effects, downloading. A **new background** costs credits again.
5. If the AI fails, the credits are refunded automatically.

Without any AI key the app runs in **demo mode**: generation is free, uses the built-in procedural backgrounds and skips the cut-out. Useful for trying the site.

**Credits**

- New accounts get free credits (default 3, change it in Admin → Settings).
- Credit packs (one-time): 10 / 30 / 100 credits for $4.99 / $11.99 / $29.99.
- Plans (monthly): Starter 40 credits $9.99, Pro 120 credits $19.99. Credits are added on every paid invoice and they stack.
- Every change is written to a ledger, visible to the user (Billing) and to admins (Transactions).
- Change prices in `src/lib/pricing.ts`, then re-run `npm run stripe:setup`.

**Admin panel** (`/admin`)

- Overview: users, banners, 30-day revenue, active subscriptions, generations, credits in circulation, setup warnings.
- Users: search, open a user, **add or remove credits** (quick +5/+10/+25… buttons or any amount with a reason), make/remove admin, suspend/reactivate, see their history and banners.
- Banners: every banner with its owner, filter failed ones (with the error), delete.
- Templates: edit names, AI prompt, colors, layout, cost per generation, order, hide/show, create new styles — with live preview.
- Transactions and Payments: full ledger and Stripe payments.
- Settings: free signup credits, max upload size, a site-wide notice banner.

---

## Setup

You need Node 20+, a PostgreSQL database, a Stripe account and a Replicate account (or OpenAI).

### 1. Install

```bash
npm install
cp .env.example .env
```

Fill in `.env` (every variable is explained in `.env.example`). Minimum to run locally: `DATABASE_URL`, `AUTH_SECRET`, `ADMIN_EMAILS`.

### 2. Database

```bash
npm run db:push     # creates the tables
npm run db:seed     # adds the 8 default templates + settings
```

### 3. Run

```bash
npm run dev
```

Open http://localhost:3000 and sign up with the email you put in `ADMIN_EMAILS` — that account becomes admin. (You can also run `npm run make-admin -- you@example.com`.)

### 4. AI

Create a token at replicate.com → Account → API tokens, and set `REPLICATE_API_TOKEN`. Each banner calls two models (background removal + background image); check Replicate's pricing page for the current per-run cost of each model and set your credit prices with some margin. For higher quality backgrounds set `REPLICATE_IMAGE_MODEL="black-forest-labs/flux-1.1-pro"` (costs more per image).

To use OpenAI for backgrounds instead: `AI_PROVIDER="openai"` and `OPENAI_API_KEY`. Background removal still uses Replicate.

### 5. Stripe

1. Put your secret key in `STRIPE_SECRET_KEY` (use a test key `sk_test_…` first).
2. Run `npm run stripe:setup` — it creates the products and prices and prints the 5 `STRIPE_PRICE_…` lines. Paste them into `.env`.
3. Create a webhook endpoint in Stripe → Developers → Webhooks:
   - URL: `https://YOUR-DOMAIN/api/stripe/webhook`
   - Events: `checkout.session.completed`, `invoice.paid`, `customer.subscription.updated`, `customer.subscription.deleted`
   - Copy the signing secret into `STRIPE_WEBHOOK_SECRET`.
4. In Stripe → Settings → Billing → Customer portal, turn on the portal (lets users cancel or switch plans).

For local testing: `stripe listen --forward-to localhost:3000/api/stripe/webhook` and use the `whsec_…` it prints. Test card: `4242 4242 4242 4242`.

### 6. File storage

`STORAGE_DRIVER="local"` saves to `./uploads` — fine for your computer, **not for Vercel** (files disappear). For production use any S3-compatible bucket; Cloudflare R2 is cheap and has free egress:

1. Create an R2 bucket and an API token with read/write.
2. Enable public access (or attach a custom domain) and put that URL in `S3_PUBLIC_URL`.
3. Set `STORAGE_DRIVER="s3"`, `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`.
4. **Add a CORS rule** allowing `GET` from your site's domain. The editor draws images on a canvas and the browser blocks exporting it without CORS:

```json
[{ "AllowedOrigins": ["https://YOUR-DOMAIN"], "AllowedMethods": ["GET"], "AllowedHeaders": ["*"], "MaxAgeSeconds": 86400 }]
```

### 7. Deploy (Vercel)

1. Push the project to GitHub and import it in Vercel.
2. Add all environment variables from `.env` (with `NEXT_PUBLIC_APP_URL` set to your real domain).
3. Database: Neon or Supabase Postgres both work; run `npm run db:push && npm run db:seed` once against it from your computer.
4. Generation routes ask for 60 s (`maxDuration`). That's the Hobby plan limit; most generations take 10–30 s. If you see timeouts, upgrade to Pro and raise `maxDuration` in `src/app/api/banners/route.ts` and `.../background/route.ts`.

---

## Customizing

- **Brand name**: `NEXT_PUBLIC_SITE_NAME`. Colors and UI fonts: `src/app/globals.css` and `src/app/fonts.ts`.
- **New styles**: Admin → Templates → New template. The prompt drives the AI background; the style JSON drives colors, fonts (`anton`, `bebas`, `gothic`, `brush`, `sans`), particles (`sparks`, `embers`, `snow`, `none`) and effects (`ghost`, `giantText`, `streaks`).
- **New layouts** (beyond Player / Champions / Event): add a function in `src/lib/render/renderer.ts`, a value in the `Layout` enum in `prisma/schema.prisma`, and its fields in `LAYOUT_FIELDS` in `src/lib/templates.ts`.
- **Texts**: `src/i18n/dict.ts` (both languages side by side).

## Notes

- Users must only upload photos and logos they have rights to; the creator page says so. If you sell this publicly, add Terms of Service covering that, and consider reviewing the Admin → Banners page regularly.
- The background prompt from users is filtered for obvious NSFW/violent words, and the AI providers apply their own safety filters.
- Rate limits (login, sign-up, uploads, generations) are in-memory per server instance. For a big launch, move them to Redis/Upstash.
- This project was written without being able to run `npm install` in the build environment, so do the first `npm run build` locally and fix anything a newer package version complains about before deploying. The banner renderer itself was tested in a headless browser.
