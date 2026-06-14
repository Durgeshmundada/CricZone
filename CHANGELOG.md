# Changelog

This changelog summarizes the production-readiness audit. Commit history contains the detailed implementation for each phase.

## Phase 1 - Repository Cleanup

- Rotated exposed credentials, purged the committed environment file from Git history, removed generated binaries/dead files, and strengthened ignore rules.

## Phase 2 - Security

- Added explicit security headers, rate limits, request validation, MongoDB key rejection, regex escaping, stronger password hashing, account lockout, and rotating refresh sessions.
- Updated compatible dependencies until the production audit reported zero known vulnerabilities.

## Phase 3 - Backend Architecture

- Extracted toss and scoring services, added bounded pagination metadata, replaced an inefficient billing query, and added indexes for common access patterns.

## Phase 4 - Frontend Modularization

- Split the browser monolith into focused no-build modules, hardened dynamic rendering, removed inline handlers, and updated CSP/service-worker behavior.

## Phase 5 - Tests and Coverage

- Replaced Atlas-dependent tests with an in-memory MongoDB harness, expanded API/service coverage, and enforced controller/service coverage thresholds.

## Phase 6 - Containers and CI

- Added Docker and Compose configuration, ESLint, and GitHub Actions jobs for linting, testing, clean installs, and production dependency auditing.

## Phase 7 - Observability

- Added structured Pino logging, request IDs, response correlation headers, timing metadata, and request IDs in JSON errors.

## Phase 8 - Accessibility

- Corrected labels, headings, table semantics, contrast, focus-visible/reduced-motion behavior, dialog focus management, and mobile navigation keyboard handling.

## Phase 9 - Documentation

- Expanded project/setup documentation, documented every runtime environment variable, added served OpenAPI auth/match documentation, and repaired the root frontend verification command.
