SEMENTAL AI BOT v5.14 — WINDOWS CONTROL CENTER SUPPORT

This is your v5.13 bot with the Windows Control API added. Existing Discord commands, rules, verification, tickets, AI, levels, moderation, tournaments and dashboard remain in place.

WHAT CHANGED
- /health still works exactly as before.
- Adds authenticated /api/control/* routes used by SEMENTAL AI Control Center V7.
- Authentication uses CONTROL_API_SECRET when configured.
- If CONTROL_API_SECRET is blank, it automatically uses your existing DASHBOARD_PASSWORD.
- Adds live status, Discord channel sync, AI/knowledge settings sync, feature toggles, full rules list/edit/delete/publish, re-index, and Railway restart.

RAILWAY
Deploy this folder the same way you deploy your current SEMENTAL bot. Keep your existing Railway variables and /data volume. You do NOT need to delete rules-panels.json or your saved bot data.

The Windows app should use the same public Railway URL and your DASHBOARD_PASSWORD unless you choose to set CONTROL_API_SECRET separately.
