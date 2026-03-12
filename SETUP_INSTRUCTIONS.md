# TurfBooking Setup and Deployment

## Required environment variables (`backend/.env`)

```env
MONGO_URI=mongodb://localhost:27017/criczone
JWT_SECRET=replace-with-a-strong-secret
PORT=5000
NODE_ENV=development
CLIENT_URL=http://localhost:3000
```

Notes:
- `MONGO_URI` and `JWT_SECRET` are required.
- `PORT` defaults to `5000` if omitted.
- `CLIENT_URL` can be a comma-separated list of allowed frontend origins.

## Local development

1. Install backend dependencies:

```bash
cd backend
npm install
```

2. Start backend:

```bash
npm run dev
```

3. Open app:
- Preferred: `http://localhost:5000` (frontend is served by backend from `public/`)
- Optional separate static frontend:
```bash
npx http-server public -p 3000
```

4. Verify backend health:
- `http://localhost:5000/api/health`

## Production deployment

Set production env values on your host:

```env
NODE_ENV=production
MONGO_URI=<your-atlas-or-managed-mongo-uri>
JWT_SECRET=<strong-random-secret>
PORT=<platform-port-or-5000>
CLIENT_URL=https://your-domain.com
```

Then start backend:

```bash
cd backend
npm start
```

Deployment behavior:
- Backend serves API at `/api/*`
- Frontend is served from `public/`
- Frontend API base now auto-resolves for local and production domains

## Free deployment (Render + MongoDB Atlas)

This is the easiest no-cost path for this project in one URL.

### 1. Push code to GitHub

Create a GitHub repo and push this project.

### 2. Create free MongoDB Atlas database

1. Sign in to Atlas.
2. Create a free cluster (`M0`).
3. Create a database user.
4. Add network access (`0.0.0.0/0` for initial testing, tighten later).
5. Copy connection string and replace `<username>`, `<password>`.

### 3. Deploy to Render (free)

1. Sign in to Render and connect your GitHub repo.
2. Choose **Blueprint** deploy so Render reads `render.yaml`.
3. In Render environment variables:
   - `MONGO_URI` = your Atlas connection string
   - `CLIENT_URL` = your Render app URL (example: `https://criczone-app.onrender.com`)
4. Deploy.

After deploy, your free domain is:
- `https://<your-service-name>.onrender.com`

Health check:
- `https://<your-service-name>.onrender.com/api/health`

### 4. Build Android app once with hosted shell URL

```powershell
cd mobile
powershell -ExecutionPolicy Bypass -File .\build-android.ps1 -AppUrl https://<your-service-name>.onrender.com -ApiBase https://<your-service-name>.onrender.com/api
```

Share:
- `mobile\CricZone-debug.apk`

Now users install once, and future frontend updates are picked from your live URL.

## Mobile app for friends (PWA)

This project now supports install as a mobile app (Progressive Web App):
- Android (Chrome): open your deployed URL -> tap `Install App` button or browser menu -> `Install app`.
- iPhone (Safari): open your deployed URL -> Share -> `Add to Home Screen`.

Important:
- Install works best on `https://` domains (or `http://localhost` for local testing).
- Share your deployed domain URL with friends, not local IP/localhost.

## Android APK option (native wrapper)

You can also generate an Android APK using Capacitor:

```powershell
cd mobile
powershell -ExecutionPolicy Bypass -File .\build-android.ps1 -ApiBase https://your-domain.com/api
```

Alternative (hosted shell):
```powershell
cd mobile
powershell -ExecutionPolicy Bypass -File .\build-android.ps1 -AppUrl https://your-domain.com
```

APK path:
- `mobile\CricZone-debug.apk`

## Update app without reinstalling APK

Use hosted shell mode so app UI is loaded from your live domain:

```powershell
cd mobile
powershell -ExecutionPolicy Bypass -File .\build-android.ps1 -AppUrl https://your-domain.com -ApiBase https://your-api-domain.com/api
```

How it works:
- Friends install APK once.
- Later UI updates are deployed to your domain (`public/` changes on server).
- App fetches latest UI on launch, so no new APK for normal frontend changes.

Still requires a new APK:
- native Android changes (Capacitor plugins, manifest, permissions, icons, splash, app name/id)
- if you change app signing/app id

## Troubleshooting

- `ERR_CONNECTION_REFUSED`: backend is not running or wrong port.
- MongoDB errors: verify `MONGO_URI` and network access from your host.
- JWT errors on startup: set `JWT_SECRET`.
- CORS blocked in production: set `CLIENT_URL` to your real frontend domain.
- `python.exe` not found when serving frontend: use `npx http-server public -p 3000` instead of Python-based static server commands.
