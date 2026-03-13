# CricZone (Turf + Cricket App)

Backend + production frontend ship together from one Node.js service. The deployable web app is the checked-in `public/` folder served by `backend/server.js`.

## Verify Before Deploy

Run the production verification command from the repo root:

```powershell
npm run verify
```

That command checks the shipped frontend bundle syntax and runs the backend test suite.

## Render Deploy

1. Push this repo to GitHub.
2. Create a MongoDB Atlas cluster and collect the connection string.
3. Create a Render web service using the included `render.yaml`.
4. Set the required Render environment variables:
   - `MONGO_URI`
   - `JWT_SECRET`
   - `CLIENT_URL=https://<your-service-name>.onrender.com`
5. Keep `NODE_ENV=production`.

The frontend now defaults to the same origin as the deployed site, so the web build does not need a hardcoded API URL.

Detailed guide: `SETUP_INSTRUCTIONS.md`

## Secret Hygiene

- Do not commit `backend/.env`.
- Keep local development secrets only on your machine.
- Rotate any secret that has ever been committed or shared.

## Mobile App

Build the hosted-shell APK so future UI updates come from your deployed site:

```powershell
cd mobile
powershell -ExecutionPolicy Bypass -File .\build-android.ps1 -AppUrl https://<your-service-name>.onrender.com -ApiBase https://<your-service-name>.onrender.com/api
```

APK output:
- `mobile\CricZone-debug.apk`

Users install once; later frontend updates are delivered from the live site without reinstalling the APK.

