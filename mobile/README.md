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
1. Apple Developer Program ($99/year) and an app record in App Store Connect with bundle id `pro.kixo.app`.
2. The workflow builds the iOS project on a Mac runner to check it compiles (`kixo-ios-project`).
3. Signing/uploading needs your Apple account: an App Store Connect API key (Issuer ID, Key ID, .p8) added as
   secrets — then the upload step can be switched on.
4. Before submitting: buying credits must not appear inside the iOS app (Apple in-app purchase rules).
