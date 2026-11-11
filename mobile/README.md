# KIXO mobile apps (App Store + Google Play)

A native shell (Capacitor 7) that opens **kixo.pro** full-screen — every website update is in the apps at once,
no resubmitting. App id: `pro.kixo.app`. Built in the cloud by GitHub Actions (`.github/workflows/mobile.yml`,
run it from GitHub → Actions → "Mobile apps" → Run workflow). No Mac needed for the Android build.

## Google Play
1. Create a Google Play Console account (one-time $25).
2. Run the workflow. The first run (with no keystore secret yet) makes your **upload key** and attaches it as
   `android-upload-key` — download it, keep it safe forever, and add its two values as repository secrets:
   `ANDROID_KEYSTORE_BASE64` and `ANDROID_KEYSTORE_PASSWORD` (Settings → Secrets → Actions). Then delete that artifact.
3. Run the workflow again → artifact `kixo-android` holds `app-release.aab` (signed) — upload it in Play Console.

## App Store
1. Join the Apple Developer Program ($99/year) and create the app in App Store Connect with bundle id `pro.kixo.app`.
2. App Store Connect → Users and Access → Integrations → App Store Connect API: create a key with the **Admin** role.
   Download the .p8 file (only once). Add four repository secrets (GitHub → Settings → Secrets → Actions):
   `APPLE_TEAM_ID` (Membership page), `ASC_KEY_ID`, `ASC_ISSUER_ID` and `ASC_KEY_P8` (the .p8 file's whole text).
3. Run the workflow ("Mobile apps" → Run workflow). The iOS job signs the app and uploads it; a few minutes later it
   shows in App Store Connect → TestFlight. Each run is a new build number.
4. Fill in the listing (screenshots, description, privacy answers, a demo login for the reviewer) and submit.
5. Credits are never sold inside the apps: the site hides every buying page and button when its user agent says
   "KIXOApp" (Apple and Google require their own in-app purchase for digital goods).
