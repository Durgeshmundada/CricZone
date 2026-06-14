# CricZone Production-Readiness Audit

Audit started June 13, 2026. Credential rotation was confirmed by the repository
owner before repository cleanup began.

## Findings

| # | Severity | Finding | Location | Status |
|---|---|---|---|---|
| 1 | Critical | A live MongoDB URI and JWT secret were committed. | `backend/.env`, original commits `85523c7`, `565b023`, `8ebede8` | Fixed - credentials rotated and reachable local history purged in Phase 1. |
| 2 | Critical | Authentication endpoints have no rate limiting. | `backend/routes/userRoutes.js` | Fixed - five attempts per 15 minutes in Phase 2. |
| 3 | Critical | User input is interpolated into regular expressions. | `backend/controllers/userController.js`, `backend/controllers/teamController.js`, `backend/models/User.js` | Fixed - shared metacharacter escaping in Phase 2. |
| 4 | Major | Match scoring and toss setup are oversized controller functions. | `backend/controllers/matchController.js` | Fixed - scoring/stat propagation and toss initialization moved to focused services in Phase 3. |
| 5 | Major | Several list endpoints are unbounded. | Match, tournament, team, booking, post, and turf APIs | Fixed - bounded `page`/`limit` queries with pagination metadata in Phase 3. |
| 6 | Major | Mutating endpoints lack centralized schema validation. | `backend/controllers`, `backend/routes` | Fixed - Zod schemas and validation middleware cover all mutating routes in Phase 2. |
| 7 | Major | Security middleware was incomplete: implicit CSP and no MongoDB operator rejection. | `backend/server.js` | Fixed - explicit Helmet CSP/HSTS, 100/min global limiter, compression, and recursive key rejection in Phase 2. |
| 8 | Major | Access tokens are long-lived and cannot be rotated or revoked. | `backend/controllers/userController.js` | Fixed - 30-minute access tokens plus hashed rotating refresh sessions, refresh, and logout endpoints in Phase 2. |
| 9 | Major | User-generated frontend content is frequently rendered with `innerHTML`. | Frontend rendering modules | Fixed - Phase 4 added context escaping, identifier/CSS guards, URL allowlisting, and handler regression tests. |
| 10 | Major | Automated coverage is narrow and currently depends on an external Atlas database. | `backend/tests` | Fixed - Phase 5 uses an isolated memory database, 12 suites, and enforced 70% controller/service coverage thresholds. |
| 11 | Major | CI and container-based local setup are missing. | Repository root | Fixed - Phase 6 added Docker, Compose, ESLint, and GitHub Actions lint/test/build checks. |
| 12 | Minor | Generated APK binary was committed. | `mobile/CricZone-debug.apk` | Fixed - Phase 1 |
| 13 | Minor | Empty, unused model file was committed. | `backend/models/matchModel.js` | Fixed - Phase 1 |
| 14 | Minor | bcrypt work factor is 10. | `backend/models/User.js` | Fixed - increased to 12 in Phase 2. |
| 15 | Minor | Login attempts are not locked out. | User model and controller | Fixed - 15-minute lock after five failures in Phase 2. |
| 17 | Major | Production dependencies initially reported nine known vulnerabilities, including JWT and Socket.io advisories. | `backend/package-lock.json` | Fixed - compatible dependency updates; `npm audit --omit=dev` reports zero vulnerabilities. |
| 16 | Minor | Backend logging is unstructured. | Backend source | Fixed - Phase 7 added Pino JSON logging, readable development output, and request correlation IDs. |
| 18 | Major | Existing pages had incomplete form labeling, heading hierarchy, keyboard focus handling, and mobile navigation semantics. | `public/index.html`, `public/styles.css`, frontend modules | Fixed - Phase 8 added accessible structure, visible focus, dialog focus management, contrast corrections, and keyboard-safe mobile navigation. |
| 19 | Minor | Root verification still parsed the deleted frontend monolith, and API/environment documentation was incomplete. | `package.json`, `README.md`, `SETUP_INSTRUCTIONS.md`, API routes | Fixed - Phase 9 checks every shipped script, documents all runtime variables, and serves a validated OpenAPI auth/match specification. |

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

## Phase 3 Notes

- Moved score processing, extras, wickets, innings transitions, match completion, and user/team statistics into `backend/services/scoringService.js`.
- Moved toss resolution and innings reset into `backend/services/matchSetupService.js`; the match controller now delegates and formats responses.
- Added bounded pagination with canonical `data` and `meta` fields while preserving legacy collection aliases used by the frontend.
- Confirmed timestamps on Booking, Post, Turf, Team, Tournament, and Match and added compound indexes for their active filters and sorts.
- Focused Phase 2/3 and public contract suites pass (13/13).

## Phase 4 Notes

- Split the 4,071-line browser script into ordered API, UI, team, match, booking, player, turf, tournament, and application modules without introducing a build dependency.
- Audited all remaining `innerHTML` writes. Dynamic text is HTML/attribute escaped, object identifiers and CSS tokens are allowlisted, and remote image URLs are restricted to HTTP(S) or non-SVG raster data URLs.
- Removed inline event handlers and enabled CSP `script-src-attr 'none'`; user actions now use delegated or directly registered listeners.
- Added public contract checks for module order, independent syntax parsing, inline handler absence, and rendering guards.
- Browser smoke verification passed for shell rendering and navigation. Expected API error states appeared because the verification server intentionally hosted static assets without the backend.
- The post-change full suite passed 15/16 tests; the remaining match API test is the documented Atlas DNS dependency addressed in Phase 5.

## Phase 5 Notes

- Added `mongodb-memory-server` 10.4.3, the newest release compatible with the project's Node 18 runtime, and centralized Jest database setup/cleanup.
- Added Supertest suites for users, teams, tournaments, bookings, turfs, posts, and leaderboards; expanded match API coverage for listing, reports, authorization, and deletion.
- Tests exposed and fixed a missing tournament-standings ownership check and a Zod/Mongoose `minPlayers` mismatch.
- The full coverage run passes 26/26 tests across 12 suites: 74.59% lines overall, 72.21% controller lines, and 80.13% service lines.
- Jest now enforces at least 70% statements/lines globally and for controllers/services, plus 70% functions for controllers/services.

## Phase 6 Notes

- Added a multi-stage Node 18 Alpine production image and a local Compose stack with MongoDB 8.0 and a persistent volume.
- Added ESLint 9.39.4, the current line compatible with Node 18, and fixed four unused-code findings.
- Added GitHub Actions jobs for linting, coverage tests, and a clean production dependency install/audit on pushes to `main` and all pull requests.
- ESLint, all 26 tests, YAML lint, Dockerfile lint, clean production install, and production audit pass. Docker is not installed on the audit workstation, so an actual image build could not be executed locally.

## Phase 7 Notes

- Replaced production `console` calls with Pino 9.14.0, the newest Pino 9 release selected for Node 18 compatibility; development uses `pino-pretty` and tests are silent.
- Added per-request UUIDs, trusted conservative inbound `X-Request-Id` values, child loggers, response headers, duration/status request logs, and automatic request IDs in every JSON error response.
- Added regression coverage for propagated/generated request IDs. ESLint, all 26 tests, coverage thresholds, production JSON logging, and production dependency audit pass.
- Sentry remains intentionally unconfigured because no `SENTRY_DSN` was supplied.

## Phase 8 Notes

- Associated every static form label with its control, corrected page heading hierarchy, added table captions/header scopes, and replaced the simulated brand button with a native control.
- Added global `:focus-visible` treatment and reduced-motion support. Dark-theme text colors and primary/error backgrounds were adjusted to meet WCAG AA contrast targets.
- Dialogs now use `aria-modal`, inert hidden state, initial-focus placement, a keyboard focus trap, Escape dismissal, and trigger-focus restoration.
- Mobile navigation now exposes accurate expanded/hidden state, removes closed links from keyboard navigation, closes on Escape, and restores focus to the toggle.
- HTML accessibility validation, Pa11y/Axe WCAG2AA scanning, managed-Chromium desktop/mobile checks, modal keyboard testing, and browser console checks pass. Axe's gradient-background contrast cases were manually reviewed because they are marked as needing human review.

## Phase 9 Notes

- Expanded the root README with product features, architecture, quick-start, verification, API documentation, deployment, and mobile guidance; linked the complete setup guide.
- Documented every runtime environment variable, including the preferred `JWT_ACCESS_EXPIRE`, legacy `JWT_EXPIRE`, refresh lifetime, logging, and CORS controls.
- Added a checked-in OpenAPI 3.0 document for the authentication and match APIs and exposed it at `/api/docs` and `/api/docs/openapi.json` without adding a runtime dependency.
- Added a dedicated documentation endpoint test and validated the specification with Redocly CLI.
- Replaced the stale `public/script.js` syntax check with a cross-platform script that parses all 11 shipped browser/service-worker files. Root `npm run verify` is functional again.

## Decisions Needed

- Implement email verification for `User.isVerified`, or remove the unused field.
- Enable Sentry only if a `SENTRY_DSN` is supplied.
- Revisit a frontend bundler and native ES-module migration after the global-function compatibility layer is retired.
- Decide whether OpenAPI coverage should expand beyond auth and match endpoints.
