# KIXO | GFX STUDIO — Discord Bot

This `kixo` branch contains an independent, rebranded copy of the SEMENTAL Discord bot. The original SEMENTAL production branch/services are unchanged.

## Features
- English / Spanish editable studio rules.
- Ticket departments: 🎨 New Design Order, ✏️ Revision Request, 📩 Order Support, 🤝 Collaboration.
- Private intake forms, staff claims, comments, transcripts, close/archive/reopen, image uploads, and admin controls.
- Welcome banners, verification, custom commands, polls, giveaways, moderation, invite tracking, backups.
- Unclaimed tickets close and archive after 24 hours by default, never automatically delete; claimed tickets are protected.

## Discord setup
Create a separate Discord Developer Portal application and bot for **KIXO**. Add it to the KIXO guild with `bot` and `applications.commands` scopes. Enable Server Members and Message Content privileged intents. Give it View Channels, Send Messages, Embed Links, Read Message History, Manage Channels, Manage Roles, Attach Files, Manage Messages, and moderation permissions only where needed.

**Never commit tokens.** Set the following directly in the new KIXO Railway bot service:
```env
DISCORD_TOKEN=<new KIXO bot token>
GUILD_ID=<new KIXO Discord server ID>
DATA_DIR=/data
RULES_DATA_DIR=/data
BRAND_NAME=KIXO | GFX STUDIO
BOT_NAME=KIXO | GFX STUDIO
BRAND_COLOR=#FF2D8B
TICKET_PANEL_COLOR=#FF2D8B
TICKET_AUTO_DELETE_ENABLED=true
TICKET_AUTO_DELETE_HOURS=24
AUTO_DISCOVER_CHANNELS=false
SPAM_GUARD_ENABLED=false
VERIFY_DEADLINE_ENABLED=false
BOT_CONTROL_SECRET=<long unique random secret>
```
Mount a dedicated, empty Railway volume at `/data` for KIXO. Configure the separate web dashboard with the same `BOT_CONTROL_SECRET`, `BOT_API_BASE_URL` pointing to the KIXO bot service, and a unique `DASHBOARD_PASSWORD` and `DASHBOARD_SESSION_SECRET`.

## After the KIXO bot is online
1. Assign ticket open, claimed and closed categories and your staff role.
2. Use `/ticket-publish-panel` to publish the studio design-order buttons.
3. Use `/rules-publish` for the bilingual rules panel.
4. Set your welcome and verification channels, test one ticket start-to-finish, then invite clients.

**Current limitation:** KIXO cannot connect to Discord without its own token and guild ID. Admin dashboard functions requiring the bot will not work until then.
