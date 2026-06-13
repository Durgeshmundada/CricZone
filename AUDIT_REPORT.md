# CricZone Production-Readiness Audit

Audit started June 13, 2026. Credential rotation was confirmed by the repository
owner before repository cleanup began.

## Findings

| # | Severity | Finding | Location | Status |
|---|---|---|---|---|
| 1 | Critical | A live MongoDB URI and JWT secret were committed. | `backend/.env`, original commits `85523c7`, `565b023`, `8ebede8` | Fixed - credentials rotated and reachable local history purged in Phase 1. |
| 2 | Critical | Authentication endpoints have no rate limiting. | `backend/routes/userRoutes.js` | Fixed - five attempts per 15 minutes in Phase 2. |
| 3 | Critical | User input is interpolated into regular expressions. | `backend/controllers/userController.js`, `backend/controllers/teamController.js`, `backend/models/User.js` | Fixed - shared metacharacter escaping in Phase 2. |
| 4 | Major | Match scoring and toss setup are oversized controller functions. | `backend/controllers/matchController.js` | Open - Phase 3 |
| 5 | Major | Several list endpoints are unbounded. | Match, tournament, team, and booking controllers | Open - Phase 3 |
| 6 | Major | Mutating endpoints lack centralized schema validation. | `backend/controllers`, `backend/routes` | Fixed - Zod schemas and validation middleware cover all mutating routes in Phase 2. |
| 7 | Major | Security middleware was incomplete: implicit CSP and no MongoDB operator rejection. | `backend/server.js` | Fixed - explicit Helmet CSP/HSTS, 100/min global limiter, compression, and recursive key rejection in Phase 2. |
| 8 | Major | Access tokens are long-lived and cannot be rotated or revoked. | `backend/controllers/userController.js` | Fixed - 30-minute access tokens plus hashed rotating refresh sessions, refresh, and logout endpoints in Phase 2. |
| 9 | Major | User-generated frontend content is frequently rendered with `innerHTML`. | `public/script.js` | Open - Phase 4 |
| 10 | Major | Automated coverage is narrow and currently depends on an external Atlas database. | `backend/tests` | Open - Phase 5 |
| 11 | Major | CI and container-based local setup are missing. | Repository root | Open - Phase 6 |
| 12 | Minor | Generated APK binary was committed. | `mobile/CricZone-debug.apk` | Fixed - Phase 1 |
| 13 | Minor | Empty, unused model file was committed. | `backend/models/matchModel.js` | Fixed - Phase 1 |
| 14 | Minor | bcrypt work factor is 10. | `backend/models/User.js` | Fixed - increased to 12 in Phase 2. |
| 15 | Minor | Login attempts are not locked out. | User model and controller | Fixed - 15-minute lock after five failures in Phase 2. |
| 17 | Major | Production dependencies initially reported nine known vulnerabilities, including JWT and Socket.io advisories. | `backend/package-lock.json` | Fixed - compatible dependency updates; `npm audit --omit=dev` reports zero vulnerabilities. |
| 16 | Minor | Backend logging is unstructured. | Backend source | Open - Phase 7 |

## Phase 1 Notes

- The exposed MongoDB password and JWT secret were rotated before cleanup.
- `backend/.env` remains local and ignored; `backend/.env.example` contains placeholders only.
- Git history was rewritten with `git-filter-repo` to remove `backend/.env`. Collaborators must re-clone after the rewritten branch is force-pushed.
- The pre-change backend test run could not connect to MongoDB Atlas (`querySrv ECONNREFUSED`). The independent public contract suite passed.

## Phase 2 Notes

- Added explicit CSP directives for Google Fonts, Google Analytics, static assets, and Socket.io connections.
- Added Zod validation to every POST, PUT, and DELETE route and rejected MongoDB operator keys before routing.
- Added hashed opaque refresh tokens, rotation, logout revocation, short-lived access tokens, and login lockout.
- Focused security tests pass (5/5). The full suite remains blocked by its pre-existing dependency on the unavailable Atlas test connection; Phase 5 replaces it with an in-memory database.

## Decisions Needed

- Implement email verification for `User.isVerified`, or remove the unused field.
- Enable Sentry only if a `SENTRY_DSN` is supplied.
- Revisit a frontend bundler after no-build ES-module modularization.
- Decide whether OpenAPI coverage should expand beyond auth and match endpoints.
