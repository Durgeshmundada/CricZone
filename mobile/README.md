# CricZone Android App (Capacitor)

This folder wraps the CricZone web app into an Android app.

## What it does

- Uses Capacitor to generate a native Android project.
- Supports either:
  - remote hosted app shell (`-AppUrl`), or
  - bundled local app shell + backend API URL (`-ApiBase`)
- Produces an installable APK for sharing.

## Prerequisites

1. Node.js + npm (already installed).
2. Android Studio installed with Android SDK.
3. JDK (already installed).

## Build a debug APK

From repo root:

```powershell
cd mobile
powershell -ExecutionPolicy Bypass -File .\build-android.ps1 -ApiBase https://your-domain.com/api
```

Alternative (hosted shell):

```powershell
cd mobile
powershell -ExecutionPolicy Bypass -File .\build-android.ps1 -AppUrl https://your-domain.com
```

APK output:

`mobile\CricZone-debug.apk`

## Open project in Android Studio

```powershell
cd mobile
npm run cap:open
```

## Important

- If `-ApiBase` is omitted in bundled mode, app asks for backend URL on first launch.
- For testing over local Wi-Fi, you can use `http://<your-pc-ip>:5000/api`.
- Debug APK is fine for testing and sharing directly.
- For Play Store release, build/sign a release APK or AAB.

## One-time install update flow (no reinstall for normal UI updates)

Build once in hosted shell mode:

```powershell
cd mobile
powershell -ExecutionPolicy Bypass -File .\build-android.ps1 -AppUrl https://your-domain.com -ApiBase https://your-api-domain.com/api
```

Then:
- users install APK once
- deploy future frontend updates to `https://your-domain.com`
- app picks latest web UI without requiring a new APK

You still need a new APK for native-layer changes (permissions/plugins/app id/icons/splash).
