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
- Change prices in `src/lib/pricing.ts`; Stripe prices are created automatically.

**Admin panel** (`/admin`)

- Overview: users, banners, 30-day revenue, active subscriptions, generations, credits in circulation, setup warnings.
- Users: search, open a user, **add or remove credits** (quick +5/+10/+25… buttons or any amount with a reason), make/remove admin, suspend/reactivate, see their history and banners.
- Banners: every banner with its owner, filter failed ones (with the error), delete.
- Templates: edit names, AI prompt, colors, layout, cost per generation, order, hide/show, create new styles — with live preview.
- Transactions and Payments: full ledger and Stripe payments.
- Settings: free signup credits, max upload size, a site-wide notice banner.

---

## Go live (no computer needed — about 15 minutes)

> **Test without payments:** skip `STRIPE_SECRET_KEY` and step 7. The buy buttons show "Coming soon" and you add credits to people from **Admin → Users**. Skip `REPLICATE_API_TOKEN` too and the site runs in free demo mode (built-in backgrounds, no AI cut-out).


1. **Import the repo:** go to [vercel.com/new](https://vercel.com/new), sign in with GitHub, pick this repo and click **Deploy**. The first build fails with "DATABASE_URL is missing"; that's expected.
2. **Database:** in your Vercel project open **Storage → Create Database → Neon** (free plan), connect it to the project.
3. **File storage:** still in **Storage**, click **Create → Blob**, connect it to the project.
4. **Keys:** in **Settings → Environment Variables** add:
   - `REPLICATE_API_TOKEN` — from replicate.com → Account → API tokens (add a payment card there).
   - `STRIPE_SECRET_KEY` — from Stripe → Developers → API keys (start with the `sk_test_…` key).
   - Optional: `NEXT_PUBLIC_SITE_NAME` (your brand name).
5. **Redeploy:** Deployments → ⋯ → Redeploy. The build creates the tables and the 8 styles by itself.
6. **Become admin:** open your site and sign up. **The first account becomes admin.**
7. **Connect Stripe:** open `/admin` and tap **Connect Stripe**. That registers the webhook. Stripe products and prices are created automatically on the first purchase.

Test card: `4242 4242 4242 4242`, any future date, any CVC. When ready for real money, swap in your live `sk_live_…` key, redeploy, and tap **Connect Stripe** again.

Also turn on the customer portal in Stripe → Settings → Billing → Customer portal, so users can cancel or switch plans.

### Running it on your computer (optional)

```bash
npm install
cp .env.example .env      # set DATABASE_URL at least
npm run build && npm start   # or: npx prisma db push && npm run db:seed && npm run dev
```

For local Stripe testing: `stripe listen --forward-to localhost:3000/api/stripe/webhook` and put the `whsec_…` it prints in `STRIPE_WEBHOOK_SECRET`.

### Other storage / hosts

Without Vercel Blob you can use any S3-compatible bucket (e.g. Cloudflare R2): set `STORAGE_DRIVER="s3"` and the `S3_*` variables, and add a CORS rule allowing `GET` from your domain (the editor draws images on a canvas):

```json
[{ "AllowedOrigins": ["https://YOUR-DOMAIN"], "AllowedMethods": ["GET"], "AllowedHeaders": ["*"], "MaxAgeSeconds": 86400 }]
```

Generation routes ask for 60 s (`maxDuration`), the Vercel Hobby limit. Most generations take 10–30 s.

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
