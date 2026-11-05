# Graph Report - EasySupport  (2026-11-05)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 958 nodes · 1927 edges · 66 communities (44 shown, 22 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 39 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `2f42cbae`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- assets.mjs
- discord.js
- inspect.mjs
- draw.mjs
- art.js
- shared/db.js
- database/db.js
- src/api/routes/dashboard.js
- bot/events/interactionCreate.js
- mint.json
- src/commands/setup.js
- isModuleEnabled
- src/events/interactionCreate.js
- package.json
- frontend/views/partials/csrf-field.ejs
- web/views/partials/csrf-field.ejs
- backend/api/routes/dashboard.js
- query
- backend/api/index.js
- generate-knowledge-graph.js
- server.js
- get
- ref_node_path
- initialiseWorkspace
- src/index.js
- get
- lint.mjs
- src/commands/moderation.js
- initialiseWorkspace
- ref_node_fs
- backend/api/routes/admin.js
- web/index.js
- backend/api/routes/public.js
- src/commands/economy.js
- src/commands/giveaways.js
- .wispshot.mjs
- scripts
- src/api/services/releaseFeed.js
- database/categories.js
- src/commands/vouches.js
- getGuild
- addBalance
- addXp
- getEnabledModules

## God Nodes (most connected - your core abstractions)
1. `discord.js` - 37 edges
2. `run()` - 35 edges
3. `run()` - 35 edges
4. `getOne()` - 31 edges
5. `isModuleEnabled()` - 25 edges
6. `search()` - 22 edges
7. `getRolePermission()` - 22 edges
8. `get()` - 20 edges
9. `get()` - 20 edges
10. `getVideo()` - 19 edges

## Surprising Connections (you probably didn't know these)
- `boot()` --calls--> `createWebApp()`  [EXTRACTED]
  server.js → backend/api/index.js
- `boot()` --calls--> `deployCommands()`  [EXTRACTED]
  src/index.js → deploy-commands.js
- `checkRolePermission()` --calls--> `getRolePermission()`  [EXTRACTED]
  src/commands/vouches.js → src/database/db.js
- `boot()` --calls--> `startBot()`  [EXTRACTED]
  server.js → bot/index.js
- `boot()` --calls--> `connect()`  [EXTRACTED]
  server.js → shared/db.js

## Import Cycles
- None detected.

## Communities (66 total, 22 thin omitted)

### Community 0 - "assets.mjs"
Cohesion: 0.07
Nodes (85): AIC_FIELDS, AIC_HEADERS, applyThumb(), ARCHIVE_LICENCE, args, argv, base(), clock() (+77 more)

### Community 1 - "discord.js"
Cohesion: 0.06
Nodes (37): checkRolePermission(), execute(), checkRolePermission(), execute(), checkRolePermission(), execute(), handleBalance(), handlePay() (+29 more)

### Community 2 - "inspect.mjs"
Cohesion: 0.06
Nodes (21): allow, args, asJson, fails, HEIGHT, merged, outDir, report (+13 more)

### Community 3 - "draw.mjs"
Cohesion: 0.10
Nodes (39): adjustments(), argv, assetQueries(), ASSETS_PATH, briefStop(), briefWords(), deal(), dealHero() (+31 more)

### Community 4 - "art.js"
Cohesion: 0.11
Nodes (36): cachedAsync(), cacheDir, cardFragment(), categoryArt(), crc32(), CRC_TABLE, __dirname, emojiCacheDir (+28 more)

### Community 5 - "shared/db.js"
Cohesion: 0.10
Nodes (34): addToBlacklist(), closeTicket(), createAntiNukeLog(), createAutomodViolation(), createBan(), createGiveaway(), createMute(), createTicket() (+26 more)

### Community 6 - "database/db.js"
Cohesion: 0.10
Nodes (36): addToBlacklist(), closeTicket(), createAntiNukeLog(), createAutomodViolation(), createTicket(), deleteBan(), deleteGiveaway(), deleteMute() (+28 more)

### Community 7 - "src/api/routes/dashboard.js"
Cohesion: 0.08
Nodes (24): setupApiRoutes(), COMMAND_NAMES, __dirname, getModuleSettings(), MODULE_LABELS, MODULE_SETTINGS, projectRoot, setupAdminRoutes() (+16 more)

### Community 8 - "bot/events/interactionCreate.js"
Cohesion: 0.10
Nodes (27): acknowledge(), applyStatus(), buildIntakeModal(), checkRolePermission(), COLORS, COMMAND_MODULES, execute(), finalizeClose() (+19 more)

### Community 9 - "mint.json"
Cohesion: 0.06
Nodes (34): anchors, from, to, colors, anchors, dark, light, primary (+26 more)

### Community 10 - "src/commands/setup.js"
Cohesion: 0.12
Nodes (23): configureEmbed(), configureSessions, execute(), isModuleEnabledSync(), moduleBadge(), MODULES, openConfigureForm(), panelButtons() (+15 more)

### Community 11 - "isModuleEnabled"
Cohesion: 0.14
Nodes (26): checkRolePermission(), execute(), checkRolePermission(), execute(), execute(), checkRolePermission(), execute(), handleAddXp() (+18 more)

### Community 12 - "src/events/interactionCreate.js"
Cohesion: 0.14
Nodes (31): getStatusMeta(), resolveStaffRole(), countOpenTickets(), getGuildSettings(), getTicketById(), getTicketMessages(), isBlacklisted(), rateTicket() (+23 more)

### Community 13 - "package.json"
Cohesion: 0.10
Nodes (25): dependencies, discord.js@^14.16.3, dotenv@^16.4.5, ejs@^3.1.10, express@^4.19.2, express-rate-limit@^7.5.1, express-session@^1.18.0, gsap@^3.15.0 (+17 more)

### Community 14 - "frontend/views/partials/csrf-field.ejs"
Cohesion: 0.13
Nodes (10): fields, fields, fields, fields, fields, fields, fields, fields (+2 more)

### Community 15 - "web/views/partials/csrf-field.ejs"
Cohesion: 0.13
Nodes (10): fields, fields, fields, fields, fields, fields, fields, fields (+2 more)

### Community 16 - "backend/api/routes/dashboard.js"
Cohesion: 0.13
Nodes (17): COMMAND_NAMES, __dirname, MODULE_LABELS, MODULE_SETTINGS, modules, projectRoot, setupDashboardRoutes(), viewsDir (+9 more)

### Community 17 - "query"
Cohesion: 0.10
Nodes (20): dumpDatabase(), getAllRolePermissions(), getAllSettings(), getAntiNukeLogs(), getAutomodViolations(), getBans(), getGiveaways(), getGuildSettings() (+12 more)

### Community 18 - "backend/api/index.js"
Cohesion: 0.14
Nodes (16): adminRateLimiter, authRateLimiter, createWebApp(), getUserGuilds(), isAuthed(), requireAuth(), requireGuildAccess(), __dirname (+8 more)

### Community 19 - "generate-knowledge-graph.js"
Cohesion: 0.11
Nodes (16): catContent, categoryBlock, commandFiles, createTableMatches, dbContent, edges, eventFiles, graph (+8 more)

### Community 20 - "server.js"
Cohesion: 0.23
Nodes (10): createClient(), startBot(), boot(), config, __dirname, root, connect(), initialize() (+2 more)

### Community 21 - "get"
Cohesion: 0.12
Nodes (16): countAllOpenTickets(), countOpenTickets(), get(), getAntiNukeConfig(), getAutomodConfig(), getGiveaway(), getGuild(), getLoggingConfig() (+8 more)

### Community 22 - "ref_node_path"
Cohesion: 0.18
Nodes (9): __dirname, projectRoot, viewsDir, config, __dirname, root, buildTranscriptHtml(), buildTranscriptText() (+1 more)

### Community 23 - "initialiseWorkspace"
Cohesion: 0.26
Nodes (8): initialiseWorkspace(), enhanceRoleListPicker(), enhanceSingleRolePicker(), getPermissionStatus(), makeElement(), navigateDashboard(), reducedMotion, showToast()

### Community 24 - "src/index.js"
Cohesion: 0.23
Nodes (12): connect(), initialize(), migrate(), boot(), client, __dirname, createWebApp(), getUserGuilds() (+4 more)

### Community 25 - "get"
Cohesion: 0.26
Nodes (12): countAllOpenTickets(), get(), getGiveaway(), getManagementRole(), getSetting(), getTicketByChannel(), logMessage(), nextTicketNumber() (+4 more)

### Community 26 - "lint.mjs"
Cohesion: 0.17
Nodes (11): args, asJson, byId, EXT, files, findings, R, roots (+3 more)

### Community 27 - "src/commands/moderation.js"
Cohesion: 0.32
Nodes (11): checkRolePermission(), execute(), handleBan(), handleMute(), handleWarn(), handleWarnings(), parseDuration(), createBan() (+3 more)

### Community 28 - "initialiseWorkspace"
Cohesion: 0.29
Nodes (8): initialiseWorkspace(), enhanceRoleListPicker(), enhanceSingleRolePicker(), getPermissionStatus(), makeElement(), navigateDashboard(), reducedMotion, showToast()

### Community 29 - "ref_node_fs"
Cohesion: 0.33
Nodes (7): collectCommands(), deployCommands(), __dirname, pruneStale(), loadCommandNames(), loadModules(), PROJECT_ROOT

### Community 30 - "backend/api/routes/admin.js"
Cohesion: 0.22
Nodes (8): COMMAND_NAMES, __dirname, getModuleSettings(), MODULE_LABELS, MODULE_SETTINGS, projectRoot, setupAdminRoutes(), viewsDir

### Community 31 - "web/index.js"
Cohesion: 0.20
Nodes (8): adminRateLimiter, authRateLimiter, __dirname, mutationRateLimiter, projectRoot, publicDir, publicRateLimiter, viewsDir

### Community 32 - "backend/api/routes/public.js"
Cohesion: 0.28
Nodes (6): __dirname, projectRoot, renderLawPage(), setupPublicRoutes(), viewsDir, ejs

### Community 33 - "src/commands/economy.js"
Cohesion: 0.50
Nodes (8): checkRolePermission(), execute(), handleBalance(), handlePay(), handleSetBalance(), addBalance(), getEconomyUser(), setEconomyUser()

### Community 34 - "src/commands/giveaways.js"
Cohesion: 0.42
Nodes (8): checkRolePermission(), execute(), handleCreate(), handleEnd(), handleList(), createGiveaway(), endGiveaway(), getGiveaways()

### Community 35 - ".wispshot.mjs"
Cohesion: 0.25
Nodes (8): esc(), FONT_OPTS, FONTS, LOGO, OUT, png, ROOT, t()

### Community 36 - "scripts"
Cohesion: 0.25
Nodes (8): scripts, deploy, docs:build, docs:dev, kg:generate, release:notes, start, test

### Community 37 - "src/api/services/releaseFeed.js"
Cohesion: 0.32
Nodes (6): getReleaseFeed(), localReleaseFeed, mapGitHubRelease(), projectRoot, releaseChanges(), releaseDataPath

### Community 38 - "database/categories.js"
Cohesion: 0.32
Nodes (7): capitalize(), CATEGORIES, DEFAULT_STATUS, normalizeEntry(), normalizeQuestion(), TERMINAL_STATUS, TICKET_STATUSES

### Community 39 - "src/commands/vouches.js"
Cohesion: 0.48
Nodes (6): checkRolePermission(), execute(), handleList(), handleVouch(), createVouch(), getVouches()

### Community 40 - "getGuild"
Cohesion: 0.43
Nodes (6): bulkUpdateGuildSettings(), getGuild(), setRolePermission(), DEFAULT_ROLE_PERMISSIONS, DEFAULT_SETTINGS, execute()

### Community 42 - "addBalance"
Cohesion: 0.67
Nodes (3): addBalance(), getEconomyUser(), setEconomyUser()

### Community 43 - "addXp"
Cohesion: 0.67
Nodes (3): addXp(), getLevelingUser(), setLevelingUser()

### Community 44 - "getEnabledModules"
Cohesion: 0.67
Nodes (3): getEnabledModules(), isModuleEnabled(), setModuleEnabled()

## Knowledge Gaps
- **22 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `discord.js` connect `discord.js` to `src/commands/economy.js`, `src/commands/giveaways.js`, `art.js`, `src/api/routes/dashboard.js`, `bot/events/interactionCreate.js`, `src/commands/vouches.js`, `src/commands/setup.js`, `isModuleEnabled`, `getGuild`, `package.json`, `src/events/interactionCreate.js`, `backend/api/routes/dashboard.js`, `server.js`, `src/index.js`, `src/commands/moderation.js`, `ref_node_fs`, `backend/api/routes/admin.js`?**
  _High betweenness centrality (0.231) - this node is a cross-community bridge._
- **Should `assets.mjs` be split into smaller, more focused modules?**
  _Cohesion score 0.06648426812585499 - nodes in this community are weakly interconnected._
- **Why does `mysql2` connect `package.json` to `shared/db.js`, `database/db.js`?**
  _High betweenness centrality (0.055) - this node is a cross-community bridge._
- **Should `discord.js` be split into smaller, more focused modules?**
  _Cohesion score 0.06485671191553545 - nodes in this community are weakly interconnected._
- **Why does `scripts` connect `scripts` to `package.json`?**
  _High betweenness centrality (0.013) - this node is a cross-community bridge._
- **Should `inspect.mjs` be split into smaller, more focused modules?**
  _Cohesion score 0.06205673758865248 - nodes in this community are weakly interconnected._
- **Should `draw.mjs` be split into smaller, more focused modules?**
  _Cohesion score 0.09966777408637874 - nodes in this community are weakly interconnected._