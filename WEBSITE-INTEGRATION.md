# SMT OFFICIAL → SEMENTAL Website Connection

SMT OFFICIAL V8.23 is the source of truth for website-editable content.

## Public read endpoint

After deploying the bot on Railway, open:

```text
https://YOUR-BOT-DOMAIN/site/config
```

It returns public website content only. No bot token, control secret, staff IDs, tickets, or private Discord data are exposed.

The site should fetch this endpoint on page load and use the returned values for:

- `homepage.en` / `homepage.es`
- `league`
- `events`
- `links`
- `theme`
- `registrationOpen`
- `media.logoUrl`
- `media.leagueImageUrl`
- `media.heroImageUrl`
- `media.introVideoUrl`

## Discord workflow

```text
/smt
  → Website

/website-admin
  → Homepage EN / Homepage ES
  → League
  → Links
  → Neon Theme
  → Registration Open / Closed
  → Event Cards
  → Media / Images
  → Change Log

/website-upload type:<slot> file:<attachment>
```

Allowed upload slots:

- `logo`
- `league_image`
- `hero_image`
- `intro_video`

Uploads are saved under the persistent Railway data directory in `site-assets`.

## Railway

Keep the existing persistent volume:

```env
DATA_DIR=/data
RULES_DATA_DIR=/data
```

Optional:

```env
SITE_PUBLIC_BASE_URL=https://YOUR-BOT-DOMAIN
SITE_CORS_ORIGIN=https://YOUR-WEBSITE-DOMAIN
```

If `SITE_PUBLIC_BASE_URL` is blank, the bot builds asset URLs from Railway's forwarded request host/protocol.

## Security

Website writes are NOT public HTTP endpoints. Only staff using SMT OFFICIAL inside Discord can change website content. Staff access uses the bot's existing `Manage Server` permission or configured `STAFF_ROLE_IDS`.
