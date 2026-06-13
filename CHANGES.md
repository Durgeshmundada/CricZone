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
