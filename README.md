## V8.41 — Kick notifications

All V8.40 moderation categories remain. Configure `/moderation kick-logs channel:#moderation-logs` to send embeds when the bot kicks someone for account age, missed verification, or `/kick`. Disable using `/moderation kick-logs enabled:false`. Kicks made manually by moderators in Discord are also detected if the bot has **View Audit Log** permission. Grant **View Channel**, **Send Messages**, and **Embed Links** in the chosen channel. Notification settings persist via the existing Store.

## V8.40 — Categorized Moderation Panel

Use `/moderation panel` for a private dropdown with Overview, Account Protection, Verification Deadline, Message Filters, Spam Guard, and Staff Actions. Select a category to see the current settings and available commands. Existing moderation commands and their behavior are preserved. This panel displays guidance; settings are changed using the listed slash commands.

# SMT OFFICIAL V8.36

SEMENTAL Discord bot build focused on Discord operations.

## Included

- Advanced ticket departments and intake questions
- Claim / Unclaim button in tickets
- Claimed tickets move to a configurable claimed category
- Claimed tickets are protected from automatic deletion
- Open unclaimed tickets automatically delete after 24 hours by default
- One-tap ticket close with no close-reason form
- Ticket transcripts, archive/reopen, member controls, notes and custom staff replies
- Partnership approval flow with bilingual rules and partner channel access
- Invite tracking for normal invites and vanity invites
- Verification panel, automatic Unverified role assignment and bulk verification
- Bilingual rules panels stored persistently in `/data`
- AI server knowledge and support answers
- Moderation and cross-channel Spam Guard
- XP / rank / leaderboard
- Welcome system
- Fixtures and announcements
- Private `/smt` staff control center inside Discord

## Railway

Mount a persistent Railway volume at `/data` and set:

```env
DATA_DIR=/data
RULES_DATA_DIR=/data
```

Railway health check remains available at:

```text
/health
```

## Ticket auto-delete

Default behavior:

- Open + unclaimed: deleted after 24 hours
- Claimed: never automatically deleted
- Unclaimed after being claimed: fresh 24-hour timer

```env
TICKET_AUTO_DELETE_ENABLED=true
TICKET_AUTO_DELETE_HOURS=24
```

The same settings can be managed from `/ticket-admin`.

## Invite tracking

Use `/invite-admin` to enable tracking, select the log channel, view the leaderboard, or reset counts.

## Validation

```bash
npm run check
```


## Account Age Guard
Use `/account-age config days:<days>` to set the minimum Discord account age and `/account-age enable enabled:true` to turn it on. New human members younger than the configured age are automatically kicked. The bot needs **Kick Members** permission.

## V8.37 — /moderation fix
The missing `/moderation` slash command is now registered at bot startup and restricted to server staff.
- `/moderation status`: show auto-moderation status, filters and Manage Messages permission
- `/moderation enable enabled:true`: enable automatic word/invite filters
- `/moderation invites blocked:true`: block Discord invite links
- `/moderation words list:word1,word2`: set blocked words; set `list:clear` to clear
- `/spam-guard status`: separately configure cross-channel spam protection
- `/account-age status`: separately configure new-member account age protection

Deploy this ZIP to Railway with your existing environment variables and persistent DATA_DIR volume. Restart the service: the bot registers its server slash commands automatically at startup. Verify the bot has the applications.commands scope, Message Content privileged intent, and Manage Messages permission for automatic message deletion. Existing saved settings, tickets and rules are left untouched.

## V8.38: Account age guard inside /moderation

- `/moderation account-age days:7` enables automatic kicking for newly joining accounts younger than 7 days.
- `/moderation account-age enabled:false` disables the guard.
- `/moderation account-age` checks the current setting.
- The existing `/account-age` command remains available.
- Requires Kick Members permission, and the Guild Members privileged gateway intent enabled in the Discord Developer Portal.
- Only checks newly joining human members; does not kick existing members or bots.

## V8.39 — Verification deadline auto-kick
- `/moderation verify-deadline days:3 enabled:true verified_role:@Verified` sets the verified role and a 3-day verification deadline. All options are optional when reading the status.
- Runs 15 seconds after startup and every 15 minutes thereafter, using the Discord member join timestamp (72 hours for 3 days).
- Skips bots and members with the configured verified role; requires Kick Members permission, server member intent and correct role hierarchy.
- **Important:** Once active, this applies to existing members who have already been in the server for more than 3 days and still lack the verified role. Configure the correct role before deployment to prevent accidental kicks. Disable with `/moderation verify-deadline enabled:false`.
- Log messages use the previously configured log channel, if available.

## V8.42 — password-protected file downloads

Staff can run `/download publish` with `file`, `password`, `title`, and optional `channel`. The bot stores the uploaded file under `${DATA_DIR}/protected-downloads` and posts a public **Download** button. Members press the button, enter the password in a private Discord modal, then receive the file as an ephemeral attachment. Staff can run `/download list` and `/download remove id:<ID>`.

**IMPORTANT:** Mount a persistent Railway volume and set `DATA_DIR=/data` or files will vanish after redeploy. The bot accepts uploads up to 100 MB by default (configurable with `PROTECTED_DOWNLOAD_MAX_MB`, maximum 500 MB). **Discord still independently limits how large a file a bot can send**, so a file might be accepted but fail delivery. For larger guaranteed downloads, use a secure external file server with authenticated, expiring links. Discord ephemeral responses are private within Discord, but recipients can save or redistribute the downloaded file; this is not DRM. Passwords are salted/hashed, but administrators should avoid using any sensitive personal password. Five failed attempts trigger a 15-minute cooldown (in-memory). Old published buttons stop working after removal. Ensure the bot has permission to Send Messages and Attach Files in the destination channel, and that the destination file size fits your Discord server's upload limits.


## V8.44 — Edit protected download panels

Use `/download edit id:<ID> caption:<text> picture:<attachment>` to edit an already published panel. Both `caption` and `picture` are optional, but at least one change is needed. Use `remove_picture:true` to clear its image. The existing password and actual protected file remain unchanged. New panels store their channel and message ID automatically. For panels published before V8.44, supply `channel` and `message_id` the first time you edit them; use Discord Developer Mode → Copy Message ID. The picture must be PNG/JPG/GIF/WebP, max 8 MB.
