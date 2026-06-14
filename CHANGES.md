# Changes

## Phase 1 - Repository and Secrets Cleanup

- Confirmed rotation of the exposed MongoDB and JWT credentials.
- Removed the generated Android APK and ignored future APK build artifacts.
- Removed the empty, unused match model file.
- Expanded the placeholder environment template with documented runtime settings.
- Prepared the repository for removal of `backend/.env` from Git history.

## Phase 2 - Security Hardening

- Added explicit Helmet CSP/HSTS configuration, global and authentication-specific rate limits, compression, cookie parsing, and recursive MongoDB operator-key rejection.
- Escaped user-provided regular-expression text across player and team searches.
- Added Zod schemas and reusable validation middleware to every mutating API route.
- Replaced seven-day access tokens with 30-minute access tokens and hashed, rotating refresh sessions exposed through `/api/users/refresh` and `/api/users/logout`.
- Added five-attempt account lockout, raised bcrypt cost to 12, and prevented session fields from being selected in normal user queries.
- Updated compatible production dependencies to resolve all npm audit findings and removed redundant `fs`, `http`, and `path` packages.
- Added focused regression coverage for CSP, validation, MongoDB operator rejection, regex escaping, and auth throttling.

## Phase 3 - Backend Architecture and Pagination

- Extracted toss initialization into `matchSetupService` and scoring, innings transitions, completion, and statistics propagation into `scoringService`.
- Reduced match controller responsibilities to request authorization, service delegation, and response formatting.
- Added reusable bounded pagination and metadata to match, tournament, team, booking, post, and turf list endpoints while retaining existing response aliases.
- Replaced billing-summary document loading with a MongoDB aggregation.
- Verified model timestamps and added compound indexes for common owner, status, date, invitation, and billing queries.
- Added focused service and pagination regression tests.

## Phase 4 - Frontend Modularization and Rendering Safety

- Replaced the 4,071-line monolithic browser script with nine responsibility-focused no-build modules.
- Added quote-safe HTML escaping, CSS token and MongoDB identifier allowlists, and image URL protocol validation.
- Removed inline event handlers, blocked script attributes through CSP, and registered actions through event listeners.
- Updated service-worker caching and public contract tests for the modular asset graph.
- Verified the static shell and navigation in managed Chrome.

## Phase 5 - Isolated API Testing and Coverage

- Replaced Atlas-dependent tests with a shared `mongodb-memory-server` Jest harness.
- Added API suites for users, teams, tournaments, bookings, turfs, posts, and leaderboards and broadened the match lifecycle suite.
- Added an enforced coverage command and 70% controller/service thresholds; the final run reached 74.59% lines overall.
- Restricted tournament standings updates to the tournament owner and aligned tournament player-count validation with the database model.

## Phase 6 - Containers and Continuous Integration

- Added a multi-stage Node 18 production Dockerfile, root Docker ignore rules, and an app-plus-MongoDB Compose stack.
- Added Node-aware ESLint checks and cleaned up unused backend code found by the new gate.
- Added GitHub Actions jobs for lint, coverage tests, and clean production dependency installation/auditing.
- Documented the Docker Compose local-development workflow in `SETUP_INSTRUCTIONS.md`.

## Phase 7 - Structured Logging and Request Tracing

- Replaced backend console logging with Pino JSON logs in production and readable development output.
- Added generated or propagated request IDs, request-scoped child loggers, response headers, timing metadata, and correlation IDs in JSON errors.
- Added `LOG_LEVEL` to the environment template and regression coverage for request-ID behavior.

## Phase 8 - Accessibility

- Corrected heading hierarchy, form label associations, table semantics, native control usage, live regions, and page/navigation state attributes.
- Added visible keyboard focus styles, reduced-motion handling, and WCAG AA contrast improvements for the dark green theme.
- Added inert dialog state, initial focus, focus trapping, Escape dismissal, and trigger-focus restoration.
- Made the mobile navigation keyboard-safe with accurate expanded state, inert closed content, Escape handling, and focus restoration.
- Added accessibility contract tests and verified the existing interface with HTML validation, Pa11y/Axe, and managed Chromium at desktop and mobile widths.
