# EasySupport 2.3.0 — Your guild, your dashboard

**Draft tag:** `v2.3.0`  
**Release date:** 2026-10-21

A complete guild dashboard replaces the old status-focused experience, bringing module setup, staff access, and update notes into one searchable, responsive workspace.

## Highlights

- Sign in with Discord and manage guilds where you have server-management access.
- Configure ten EasySupport modules from guild-scoped settings pages: tickets, moderation, anti-nuke, automod, leveling, economy, giveaways, vouches, welcome and boosts, and logging.
- Assign staff roles to commands with per-guild permissions. Administrators retain their bypass, and Discord permissions remain the fallback when no role rule is configured.

## A smoother dashboard

- Search modules and commands from the guild overview.
- Search guilds, channels, categories, and roles instead of scrolling through long native menus. Multi-role controls support searching and selecting several roles.
- Move between the overview and module pages without a full page reload. Browser history and back navigation continue to work.
- See animated Save/Saved button states and custom success or error notifications when settings are submitted.
- See an animated loading state while a different guild workspace opens.
- Use a redesigned responsive site and dashboard with locally bundled fonts and assets, interaction feedback, and reduced-motion support.

## Release updates

- The dashboard release feed now reads published releases from the EasySupport GitHub repository and links to each source release.
- Added a local release-note generator for maintainers. It groups Git commit subjects, lists changed paths, and detects changed slash-command definitions without sending source code to an AI service.

## Reliability and maintenance

- Serve site assets from paths resolved relative to the application, including when the host starts Node from a different working directory.
- Request Discord guild and avatar images with supported CDN sizes.
- Configure the Discord OAuth callback URL through the environment.
- Expand ticketing command tests and close database connections after test runs.
- Add Apache 2.0 licensing and project brand documentation.

## Commands

No new slash commands were added. Guild and module setup is now managed in the dashboard rather than through legacy command-driven setup panels.

---

This is a local release draft. Review it before publishing the GitHub release. The `v2.3.0` Git tag has not been created.
