# CricZone

CricZone is a cricket community and turf-booking application. A single Express service exposes the API, Socket.IO updates, and the no-build web application from `public/`.

## Features

- Register, log in, recover passwords by email, rotate refresh sessions, and manage player profiles.
- Create reusable teams and verify team invitations.
- Schedule matches, run tosses, score ball by ball, and publish reports/highlights.
- Create tournaments, join teams, and track standings.
- Discover and book turfs, then review billing and payment state.
- View leaderboards, player statistics, and live Socket.IO score updates.
- Install the web app as a PWA or package the hosted site with Capacitor.

## Project Structure

```text
backend/                 Express API, Socket.IO, models, services, and tests
  controllers/           HTTP request handling
  docs/openapi.json      OpenAPI 3 specification for auth and match APIs
  middleware/            Authentication, validation, request IDs, sanitization
  models/                Mongoose schemas and indexes
  routes/                API route definitions
  services/              Authentication and match-domain logic
  tests/                 Jest, Supertest, and in-memory MongoDB suites
public/                  Shipped HTML, CSS, modular browser scripts, and PWA files
mobile/                  Capacitor Android wrapper and build helper
.github/workflows/       CI lint, test, and production-install checks
docker-compose.yml       Local app plus MongoDB stack
render.yaml              Render deployment blueprint
```

## Quick Start

Detailed environment, local, Docker, Render, PWA, and Android instructions are in [SETUP_INSTRUCTIONS.md](SETUP_INSTRUCTIONS.md).

```bash
cd backend
npm install
cp .env.example .env
npm run dev
```

Set at least `MONGO_URI` and `JWT_SECRET` in `backend/.env`, then open `http://localhost:5000`.

## Verification

From the repository root:

```bash
npm run verify
```

This parses every shipped browser script and runs the complete backend test suite. Additional checks:

```bash
npm run lint --prefix backend
npm run test:coverage --prefix backend
npm audit --prefix backend --omit=dev
```

## API Documentation

Run the backend and open:

- OpenAPI JSON: `http://localhost:5000/api/docs`
- Health: `http://localhost:5000/api/health`
- Readiness: `http://localhost:5000/api/ready`

The initial OpenAPI scope covers authentication and match endpoints. Expanding it to the remaining controllers is tracked in [AUDIT_REPORT.md](AUDIT_REPORT.md).

## Deployment

The frontend defaults to the deployment's own origin, so production does not need a hardcoded API URL. For Render, set `MONGO_URI`, `JWT_SECRET`, `CLIENT_URL`, `APP_URL`, `RESEND_API_KEY`, and `PASSWORD_RESET_FROM`; the included `render.yaml` supplies the service configuration.

Never commit `backend/.env`. Rotate any credential that has been committed or shared.

## Mobile

Build the hosted-shell Android app after deploying:

```powershell
cd mobile
powershell -ExecutionPolicy Bypass -File .\build-android.ps1 -AppUrl https://<your-domain> -ApiBase https://<your-domain>/api
```

Normal frontend updates then arrive from the deployed site without requiring users to reinstall the APK.
