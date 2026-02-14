# CricZone (Turf + Cricket App)

Backend + frontend in one Node.js service, with Android wrapper in `mobile/`.

## Free deploy quick path

1. Push this repo to GitHub.
2. Create a free MongoDB Atlas `M0` cluster.
3. Deploy on Render using the included `render.yaml`.
4. Set Render env vars:
   - `MONGO_URI`
   - `CLIENT_URL` = `https://<your-service-name>.onrender.com`

Detailed guide: `SETUP_INSTRUCTIONS.md`

## Mobile app (install once)

Build hosted-shell APK (so future UI updates come from your live URL):

```powershell
cd mobile
powershell -ExecutionPolicy Bypass -File .\build-android.ps1 -AppUrl https://<your-service-name>.onrender.com -ApiBase https://<your-service-name>.onrender.com/api
```

APK output:
- `mobile\CricZone-debug.apk`

Users install once; later frontend updates are deployed to your site without reinstalling APK.
