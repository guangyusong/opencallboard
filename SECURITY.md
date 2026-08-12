# Security policy

## Supported versions

Callboard is currently a prerelease prototype. Security fixes apply to the latest
published revision only.

## Reporting a vulnerability

Please do not file a public issue containing credentials, personal information, or an
unpatched exploit. Once the repository is published, use its private GitHub Security
Advisory reporting flow. Include the affected route or component, reproduction steps,
impact, and any proposed mitigation.

The default build is local-only: real provider writes and shared D1 persistence are
disabled. Do not enable them without authenticated user sessions, event-scoped
authorization, and a reviewed secret-management boundary.
