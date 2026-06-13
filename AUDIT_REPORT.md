# CricZone Production-Readiness Audit

Audit started June 13, 2026. Credential rotation was confirmed by the repository
owner before repository cleanup began.

## Findings

| # | Severity | Finding | Location | Status |
|---|---|---|---|---|
| 1 | Critical | A live MongoDB URI and JWT secret were committed. | `backend/.env`, original commits `85523c7`, `565b023`, `8ebede8` | Fixed - credentials rotated and reachable local history purged in Phase 1. |
| 2 | Critical | Authentication endpoints have no rate limiting. | `backend/routes/userRoutes.js` | Open - Phase 2 |
| 3 | Critical | User input is interpolated into regular expressions. | `backend/controllers/userController.js`, `backend/controllers/teamController.js` | Open - Phase 2 |
| 4 | Major | Match scoring and toss setup are oversized controller functions. | `backend/controllers/matchController.js` | Open - Phase 3 |
| 5 | Major | Several list endpoints are unbounded. | Match, tournament, team, and booking controllers | Open - Phase 3 |
| 6 | Major | Mutating endpoints lack centralized schema validation. | `backend/controllers`, `backend/routes` | Open - Phase 2 |
| 7 | Major | Missing Helmet, request rate limiting, and MongoDB operator sanitization. | `backend/server.js` | Open - Phase 2 |
| 8 | Major | Access tokens are long-lived and cannot be rotated or revoked. | `backend/controllers/userController.js` | Open - Phase 2 |
| 9 | Major | User-generated frontend content is frequently rendered with `innerHTML`. | `public/script.js` | Open - Phase 4 |
| 10 | Major | Automated coverage is narrow and currently depends on an external Atlas database. | `backend/tests` | Open - Phase 5 |
| 11 | Major | CI and container-based local setup are missing. | Repository root | Open - Phase 6 |
| 12 | Minor | Generated APK binary was committed. | `mobile/CricZone-debug.apk` | Fixed - Phase 1 |
| 13 | Minor | Empty, unused model file was committed. | `backend/models/matchModel.js` | Fixed - Phase 1 |
| 14 | Minor | bcrypt work factor is 10. | `backend/models/User.js` | Open - Phase 2 |
| 15 | Minor | Login attempts are not locked out. | User model and controller | Open - Phase 2 |
| 16 | Minor | Backend logging is unstructured. | Backend source | Open - Phase 7 |

## Phase 1 Notes

- The exposed MongoDB password and JWT secret were rotated before cleanup.
- `backend/.env` remains local and ignored; `backend/.env.example` contains placeholders only.
- Git history was rewritten with `git-filter-repo` to remove `backend/.env`. Collaborators must re-clone after the rewritten branch is force-pushed.
- The pre-change backend test run could not connect to MongoDB Atlas (`querySrv ECONNREFUSED`). The independent public contract suite passed.

## Decisions Needed

- Implement email verification for `User.isVerified`, or remove the unused field.
- Enable Sentry only if a `SENTRY_DSN` is supplied.
- Revisit a frontend bundler after no-build ES-module modularization.
- Decide whether OpenAPI coverage should expand beyond auth and match endpoints.
