# EasySupport 2.3.1 — Mobile dashboard navigation

**Draft tag:** `v2.3.1`
**Release date:** 2026-11-03

Improves the dashboard experience on phones and requires every merged update to be published as a versioned GitHub release.

## Dashboard experience

- Added a touch-friendly slide-out navigation drawer for mobile dashboard users.
- Added backdrop, focus, and Escape-key controls for the mobile navigation.

## Release updates

- Added a GitHub Actions policy requiring every pull request to bump the release version and include matching release notes.
- Added automatic GitHub Release publishing after a versioned change reaches `main`.

## Changed files

- `.github/workflows/release-policy.yml`
- `src/public/site.css`
- `src/public/site.js`
- `src/views/layout.ejs`

This release note is reviewed and published automatically by the repository release policy.
