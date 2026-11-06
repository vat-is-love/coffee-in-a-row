# Coffee Match: Match-3 Demo — Project Specification & Roadmap

> **Status:** Draft v1.0 · **Purpose:** single source of truth for implementation with Codex  
> **Last updated:** 2026-11-06
> **Product:** browser-based, mobile-friendly, coffee-themed Match-3 MVP with 10 levels and a public leaderboard.

## 0. Instructions for Codex (read this first)

This file is the authoritative specification and execution roadmap. Before making substantial changes:

1. Read this file and inspect the existing repository. Do not assume the repository is empty.
2. Select the **first unchecked milestone** whose dependencies are satisfied. Work on that milestone unless the developer explicitly specifies another.
3. Briefly summarize the intended files/changes and any ambiguity. Prefer the simplest solution that meets the acceptance criteria.
4. Implement in small, reviewable increments. Do not skip tests, error handling, or responsive behavior.
5. Run relevant checks, fix failures, and report commands/results. Do not claim a test passed unless it ran.
6. Update milestone checkboxes **only after** acceptance criteria are met, then add a short entry to the progress log (§17).
7. If a requirement is unclear, record an assumption under §16 and flag it. Do not silently expand scope.
8. Never implement secrets, the admin credential, leaderboard writes, or score verification as client-trusted operations.
9. Keep game logic independent from rendering so it can be unit-tested without a browser.
10. Make the repository runnable locally with documented commands throughout development.

**Instruction priority:** explicit developer request > this specification > code conventions already in the repository. If they conflict, describe the conflict and propose a resolution before rewriting large portions of code.

## 1. Product goals

### 1.1 Overview

Coffee Match is an independent coffee-themed puzzle demo. The planned snowstorm mode features a fictional traveler trapped in a Canadian snowstorm. Players complete tile-matching puzzles to clear snow and help the traveler survive. The game is an engagement widget for an existing website, **not** a full-scale commercial mobile game.

### 1.2 MVP success criteria

- A player can open the game on modern desktop or mobile browsers and finish all **10 playable levels**.
- Every level has a defined, understandable win/lose condition and increasing *overall* difficulty.
- Gameplay is based on exchanging adjacent tiles to create horizontal/vertical matches of three or more; snow is an explicit obstacle/objective.
- The game includes a level map, victory/defeat screens, local progression persistence, scoring, and a public Top-100 leaderboard.
- A player can submit a nickname, optionally an email address, and a valid score; the backend stores only the player's best qualifying score per leaderboard period.
- The leaderboard supports weekly resets and authorized manual administrative resets.
- The build can be embedded in an existing website and deployed as a static frontend plus managed backend.
- The developer can reproduce build, tests, and deployment steps from documentation.

### 1.3 Non-goals (not part of MVP)

No in-app purchases, ads, accounts/passwords, social login, matchmaking, online multiplayer, chat, push notifications, energy/lives economy, app-store releases, sophisticated 3D effects, paid analytics, or a feature-for-feature Royal Match clone. Do not use Royal Match assets, branding, or proprietary level designs.

## 2. Scope and decisions

| Item | MVP decision |
|---|---|
| Gameplay engine | **Phaser 3**, **TypeScript**, **Vite** |
| Backend | **Supabase** (PostgreSQL, Edge Functions or equivalent secure server endpoints) |
| Hosting | Static assets on a CDN/website; backend independently hosted |
| Display | Responsive portrait-first game; desktop centered with adaptive canvas |
| Controls | Pointer/touch swipe **and** tap-first/tap-second swapping; keyboard accessible for core actions where practical |
| Levels | Exactly 10, data-driven configurations |
| Board | Default 8×8; may vary per level via config |
| Board rules | Orthogonal adjacency and matches; no diagonal matching |
| Leaderboard | Global Top 100 **within current week**; score = **total points earned during a successful 10-level run** |
| Play sessions | One run spans levels 1–10; scores accrue across levels; run completes after level 10 |
| Score submission | Only a completed run qualifies; best score per nickname identity per week; backend validates run evidence |
| Weekly reset | Monday 00:00 **UTC**; new period displayed, historical scores retained or archived |
| Email | Optional, not public, never shown in leaderboard |
| Admin | Secure manual reset/current period management via authenticated server-side action |
| Languages | English UI for MVP; centralize strings for later localization |
| Character art | Client-supplied if available; placeholders until approved assets arrive |

**Decisions requiring client confirmation before production launch** are in §15. Until confirmed, implement the defaults above and avoid tightly coupling their behavior to rendering.

## 3. Player experience / screens

1. **Loading:** show progress/error state while assets load; usable fallback when audio unavailable.
2. **Start screen:** game title, Play, How to Play, Leaderboard, sound toggle.
3. **Level map:** 10 clearly labeled nodes; completed/current/locked states; play current level, replay completed levels for practice **without altering the active ranked run**.
4. **Gameplay HUD:** current level, score, remaining moves, snow remaining, audio toggle, pause/restart with confirmation where necessary.
5. **Board:** coffee cup/bean themed tile variants, snow overlay/blocker representation, visual indication of selected tile, clear action feedback.
6. **Victory:** objective met, points gained, Continue button; after level 10 show run-completed screen and score submission option.
7. **Defeat:** moves exhausted with objective incomplete; Retry. A failed level can be retried within the current run, but leaderboard scoring must discourage unlimited farming (see §5.5).
8. **Leaderboard:** current UTC week, Top 100 scores and nicknames, loading/empty/error states; form for run-qualified submission.
9. **Instructions:** explain swapping, matching, snow clearing, moves, combo cascades, and score.

All screens must work with mouse and touch; do not rely on hover-only interactions. The core game should remain operable at 320 CSS px width without page-level horizontal scrolling.

## 4. Match-3 game rules (normative)

### 4.1 Board model

- Rectangular grid; each cell has coordinates `(row, col)`, a tile type (or empty), and optional snow layers (0–2).
- At least five visually distinguishable coffee-themed tile types in the initial configuration; per-level configuration may increase the number.
- Tiles may swap with orthogonally adjacent tiles only.
- A move **succeeds** only when the swap creates at least one 3+ line involving a swapped tile; otherwise swap back with animation and **do not** consume a move.
- Locked states prevent overlapping swaps during resolution/animations.
- Initial board must have **no accidental matches** and at least one legal move. Generate deterministically from a provided RNG seed for repeatable tests.
- After each fully resolved move, if the board has no legal moves, reshuffle while preserving snow and guaranteeing a playable, match-free board; show reshuffle feedback.

### 4.2 Match resolution

1. Player selects/swaps adjacent tiles.
2. Validate resulting line(s) of 3+ identical tile types. Invalid swap is reverted.
3. Consume one move for a valid swap.
4. Clear all matched tiles simultaneously. Count overlapping horizontal/vertical matches only once per tile.
5. Decrement snow layers by one on cleared matched cells (if present).
6. Apply gravity by column, generate replacement tiles, animate movement.
7. Resolve cascades repeatedly until stable, granting score and snow damage for each cascade.
8. Check level objective, then remaining moves, then possible moves. If objective is met on the final move, **victory takes precedence**.
9. Unlock the board only when resolution and final animations finish.

### 4.3 Snow mechanics

- Snow is a **cell overlay** with 1–2 layers; tiles can occupy snowy cells.
- Clearing a tile in a snowy cell removes **one layer** from that cell. Snow does not fall with the tile.
- Completing a snow-clearing level requires all configured snow layers to be removed before valid moves are exhausted.
- Snow changes appearance to make remaining layers obvious. All snow removal events must be testable from the pure board model.

### 4.4 Scoring

Provisional formula (centralized constants, tweakable):

- Each tile cleared: **100 points**.
- Matching 4+ in one line: **+50 points** per tile beyond 3 for that line (avoid double-counting intersections).
- Snow layer removed: **+150 points**.
- Cascades: multiply tile-clear points by cascade depth, capped at ×3.
- Level completion: **+100 points per remaining move**.
- UI score must match model score; no hidden random points.

Score balancing is subject to playtesting. Ensure consistency between local display and backend validation.

### 4.5 Moves, retries, and rankings

- Each level sets its own move cap and snow pattern.
- A failed attempt may be retried; **points from a failed attempt are discarded**. The last successful completion of each level is applied only once to the active run's score.
- Replaying previously completed levels is **practice mode** and must not alter the run score.
- The ranked run is complete after successful completion of level 10. Submitted score is the sum of each level's successful result, once.
- A user may start a new run to improve their score; the backend keeps their top validated score within a week.
- Local progression is for convenience, **not proof** of a valid leaderboard score.

### 4.6 Deterministic resolution

The logic layer must provide predictable state transitions with an injected RNG seed/source. Define a compact input/event representation that permits server-side verification of runs (level, seed, attempted moves, results). Do not accept the client's final numeric score without independent validation. If server replay of all moves is impractical within MVP resources, implement a server-issued run token and server-side move verification; never pretend that client-only checks prevent cheating.

## 5. Level design

### 5.1 Configuration schema

Each level file contains, at minimum:

```ts
interface LevelConfig {
  id: number;                    // 1..10
  rows: number;
  cols: number;
  tileTypes: number;             // count of available tile types
  maxMoves: number;
  snow: Array<{row: number; col: number; layers: 1 | 2}>;
  goal: {type: 'clear_all_snow'};
  seed?: number;                 // optional for development fixtures
}
```

Validate all level files during build/test: unique IDs, sequential 1..10, coordinates in bounds, no duplicate snow cells, positive move limits, sensible tileTypes, feasible snow coverage.

### 5.2 Initial tuning blueprint (NOT final balancing)

| Level | Tile types | Max moves | Suggested snow layers / pattern | Teaching objective |
|---:|---:|---:|---|---|
| 1 | 5 | 28 | 6 single-layer, central | Learn matching |
| 2 | 5 | 27 | 10 single-layer, edges | Reach targets |
| 3 | 5 | 25 | 14 single-layer, corners | Plan swaps |
| 4 | 5 | 25 | 12 single + 3 double | Introduce double snow |
| 5 | 6 | 25 | 16 single + 3 double | More tile variety |
| 6 | 6 | 24 | 18 single + 4 double | Cascades |
| 7 | 6 | 23 | 20 single + 5 double | Efficiency |
| 8 | 6 | 22 | 20 single + 7 double | Difficult patterns |
| 9 | 6 | 21 | 22 single + 8 double | Tight move economy |
| 10 | 6 | 20 | 24 single + 10 double | Final challenge |

These are **starting values only**. Implement the exact snow coordinates in JSON; verify the generated games are winnable with a reasonable success rate using automated simulations and hands-on playtesting. Difficulty should generally grow, not necessarily monotonically in every numeric parameter. Avoid levels that are routinely impossible because of RNG.

## 6. Visuals, animation, and sound

- Brand tone: friendly cartoon, coffee and winter; visually distinct from Royal Match branding.
- Character: **a fictional traveler**, original or appropriately licensed art preferred; temporary placeholder must be easily replaceable.
- Tile assets: at least 5–6 clear coffee-themed symbols with shapes distinguishable without relying only on color.
- Feedback: select highlight, swap, invalid-swap bounce, match pop, tile fall, snow crack/break, combo, win/lose.
- Animation targets: responsive rather than elaborate; do not block the board unnecessarily.
- Sound: tile swap, match, snow removal, win, lose; mute toggle; do not autoplay audible sound before user gesture.
- Respect `prefers-reduced-motion` where feasible (shortened/minimal effects).
- Asset catalog documents filenames, dimensions, licensing/ownership, and replacement instructions.
- The app must remain playable with simple placeholder graphics throughout development.

## 7. Leaderboard, backend, privacy, security

### 7.1 User stories

- Player sees the top 100 eligible completed-run scores for the **current UTC week**.
- Player enters a nickname, optionally an email, and submits their completed run.
- A repeated qualifying submission from the same player identity updates their entry **only if the score is higher**.
- An authorized administrator can manually start a new leaderboard period / reset the active ranking.
- Weekly rollover automatically switches periods without deleting historical records.

### 7.2 Suggested server entities

- `leaderboard_periods`: `id`, `starts_at`, `ends_at`, `status` (active/closed), `created_at`.
- `run_sessions`: `id`, opaque server-issued run token hash, creation/expiry, game version, verification state, replay data or validated events, `completed_at`.
- `leaderboard_entries`: `id`, `period_id`, stable anonymous `player_id`, `nickname`, nullable `email`, `score`, `run_session_id`, `created_at`, `updated_at`.
- Optional `admin_audit_log`: timestamp, actor, action, period ID.

Use an index and uniqueness constraint on `(period_id, player_id)`; order results by score descending, then earliest qualification time as tie-breaker. An email, when present, is not a public ID. Generate a stable pseudonymous player ID; clarify client expectations around repeat submissions across devices.

### 7.3 Mandatory security behaviors

- **Never trust numeric score from browser as authoritative.** Issue server-controlled seeds/run session identifiers and verify full run transcript, or server-authorize each move and compute the score. Client-provided nickname/email is untrusted input.
- Protect submission endpoints with input validation, request/body-size limits, per-IP or per-session rate limits, and session expiry.
- Nickname: 2–24 visible characters, normalize/trim, escape output; prohibit empty/control characters. Display as plain text, never HTML.
- Email: optional; validate format and reasonable length. Store privately, never return to public leaderboard payloads or logs; collect consent/notice where applicable.
- Public API returns only nickname, score, rank, and time/period as needed.
- Disable anonymous writes to leaderboard tables. All writes go through verified server logic (RLS + server functions / trusted API).
- Admin actions require authenticated authorization on server and auditable events. No hardcoded/admin password in the frontend.
- Use environment variables for secrets; provide `.env.example` with dummy values; `.env` and credentials must be Git-ignored.
- Use sensible CORS/origin controls, TLS in production, and secure headers at the hosting layer.
- Preserve history instead of destructive weekly deletes unless client explicitly requests physical deletion.

### 7.4 Rollover behavior

- Periods begin Monday 00:00:00 UTC and end the following Monday 00:00:00 UTC (end exclusive).
- The API calculates the active period on the server; client clocks do not decide eligibility.
- Automatic weekly reset means showing a new period, not requiring a manually scheduled destructive DELETE.
- Admin reset creates/closes periods in an auditable, race-safe manner.
- Specify behavior for runs crossing the week boundary: **submission is assigned to period active at completed-run server verification**; expired runs cannot be submitted to a new period.

### 7.5 Privacy

- Clearly label email as optional; no email is needed to play.
- Do not publish emails or collect unnecessary personal information.
- Add concise privacy notice explaining data use and retention before email submission.
- Confirm any jurisdiction-specific consent/retention requirements with client before launch.

## 8. Technical architecture and code layout

Suggested (adapt if repository already has conventions):

```text
/
├── PROJECT_SPEC.md                # THIS FILE
├── README.md                      # quickstart, commands, deploy, embedding
├── .env.example
├── package.json
├── src/
│   ├── main.ts
│   ├── game/
│   │   ├── logic/                  # pure board algorithms, RNG, scoring
│   │   ├── levels/                 # 10 data-driven configs + validator
│   │   ├── scenes/                 # Phaser scenes
│   │   ├── components/             # game UI/HUD helpers
│   │   └── assets/
│   ├── services/                   # leaderboard API and storage adapters
│   ├── ui/                         # menus/forms/leaderboard
│   └── styles/
├── supabase/
│   ├── migrations/
│   └── functions/                  # verification, submit, admin control
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
└── docs/
    ├── EMBEDDING.md
    ├── DEPLOYMENT.md
    └── ASSET_LICENSES.md
```

Game **logic** knows nothing about Phaser, DOM, fetch, or storage. UI subscribes to state/events; scenes handle rendering and animation; services handle I/O. Prefer straightforward code to unnecessary abstraction.

## 9. Website integration and runtime

- Build outputs static HTML/JS/CSS/assets with Vite; document `base` path configuration for subdirectory hosting.
- Support embedding via iframe as the first-class safe default; document sizing, responsive aspect ratio, allowed origins, and optional parent messaging contract.
- Avoid global CSS leaking into host page; do not assume the hosting site's fonts or DOM structure.
- Loading failures and API downtime should not prevent local gameplay; leaderboard failure must have visible retry/error handling and must **not** invent scores or claim successful submission.
- Use asset compression/caching, lazy-load noncritical artwork, and avoid giant image/audio packages. Define a measurable load-size budget after receiving real assets.
- Test on Chrome, Firefox, Safari/iOS Safari, and Android Chrome (latest stable at release).

## 10. Quality requirements & test strategy

### 10.1 Automated tests (minimum)

- Match detection: horizontal, vertical, 3/4/5, T/L intersections, overlapping matches.
- Swaps: valid, invalid, nonadjacent, edge/corner, animation lock, moves not consumed on invalid swap.
- Board initialization: no initial matches, at least one legal swap, reproducible seeded tests.
- Resolution: gravity, refill, cascading chain, termination, no-move reshuffle.
- Snow: 0/1/2 layers, cell-fixed overlay, adjacent unrelated matches not removing snow.
- Scoring: exact formula for single match, cascades, snow bonuses, remaining-move bonus, retry handling.
- Win/lose priority on final move, no negative moves.
- Level config validation across all 10 levels.
- Ranked run: failed retries don't inflate score; practice runs excluded.
- Backend: verified-run accept, tampered score reject, replay/seed mismatch reject, duplicate submit, period rollovers, malformed payload, rate limits, unauthorized admin.
- Privacy: public API does not expose email or sensitive run tokens.

### 10.2 Browser tests

Use Playwright for critical flows: start → level 1 → valid move → victory → next; lost level → retry; complete run → submit → leaderboard; mobile viewport and basic keyboard/tap navigation; backend unavailable recovery. E2E tests may use deterministic game fixtures and isolated backend test environment.

### 10.3 Practical acceptance

- No uncaught browser errors in normal flows.
- No frozen board or infinite cascade in randomized test runs.
- Touch gestures do not cause unintended page scroll while interacting with the board.
- Game remains readable/playable at widths 320, 375, 768 and 1280 CSS px.
- Responsive game reaches playable state on a typical midrange mobile device without excessive load times.
- All 10 levels can be finished; game never locks due to impossible state.
- Restarting browser preserves local progress; server does not consider local progress a verified score.
- `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, and agreed e2e command succeed.

## 11. Developer scripts and operational docs

Provide npm scripts (or equivalent):

```text
npm run dev
npm run build
npm run preview
npm run lint
npm run typecheck
npm test
npm run test:e2e
```

README must document Node version, installation, env vars, local backend setup, test commands, production build, deployment, embedding, admin reset procedure, data migration/rollback, and asset substitution. A fresh developer should be able to run the game with placeholder assets and a local/test backend.

## 12. Roadmap — execute in order

Mark a task `[x]` **only when acceptance criteria are actually met**. Never change checkboxes to claim work that was not done.

### M0 — Repository foundation

- [x] Initialize/inspect TypeScript + Vite + Phaser project; select Node version and package manager.
- [x] Add formatting, linting, type checking, unit testing, Playwright scaffolding.
- [x] Add `.env.example`, `.gitignore`, base README, empty game shell, placeholder assets.
- [x] Confirm dev/build/test commands work.

**Done when:** clean install and local scripts run, page loads in desktop/mobile viewport.

**Accepted:** M0 is complete based on local verification. By user decision on 2026-11-06, CI setup and the initial remote CI run are deferred and are not required to close M0. Revisit CI when remote repository/server workflows are needed.

### M1 — Pure Match-3 engine (vertical slice)

- [x] Implement typed grid, tile data model, seeded RNG.
- [x] Generate stable match-free boards with at least one legal move.
- [x] Validate swaps and find all horizontal/vertical matches.
- [x] Resolve clear → gravity → refill → cascades deterministically.
- [x] Add legal-move detection and safe reshuffle.
- [x] Add comprehensive unit/property tests for these mechanics.

**Done when:** logic is fully testable without Phaser and test seeds cannot freeze or enter an endless cascade.

**Verified (2026-11-06):** M1 engine corrections pass 101 real unit tests, including seeded invariants and an adversarial constant RNG. Typecheck, lint and build pass. This acceptance covers the pure engine; the browser scene still uses legacy logic and requires M2 integration.

### M2 — Playable scene and controls

- [x] Render game board with placeholders using Phaser.
- [x] Implement touch swipe and two-tap swap, mouse input, selection feedback.
- [x] Animate swap/revert, removal, falling/refill; lock inputs during processing.
- [x] Render HUD and clear loading/error states; responsive layout.

**Done when:** a user can reliably play an endless temporary board on desktop and mobile.

**Verified (2026-11-06):** integrated pure-engine playback on the endless board; 102 unit tests and 20 desktop/mobile Chromium browser tests pass, including 40 consecutive moves per browser profile. Lint, typecheck and production build pass. Manual desktop smoke: a two-tap match resolves, tiles refill, score updates and input remains available.

### M3 — Snow, goals, scoring, 10 levels

- [ ] Implement cell-bound snow overlays (1–2 layers), remove on matching tile clears.
- [ ] Implement move limits, score formula, victory/defeat precedence, retry.
- [ ] Create and validate 10 level JSON/TS configurations.
- [ ] Implement progression and practice-vs-ranked logic; local persistence.
- [ ] Add automated simulations and manual balancing pass; record results.

**Done when:** all 10 levels are playable, goals and retries are correct, progression persists, no obvious impossible levels.

### M4 — Menus, map, art, sounds, polish

- [ ] Add start, instructions, map, pause, victory/defeat, final completion screens.
- [ ] Integrate coffee tiles, snow, traveler art or replaceable placeholders.
- [ ] Add essential animations, sound effects and mute/reduced-motion handling.
- [ ] Improve layout and interaction feedback on mobile.

**Done when:** all user-facing single-player flows are understandable and visually coherent.

### M5 — Secure leaderboard backend

- [ ] Implement database migrations, indexes, RLS, period model.
- [ ] Implement server-issued runs and actual score/move verification.
- [ ] Implement `GET /leaderboard` and verified submission endpoint (or equivalent function URLs).
- [ ] Implement nickname/optional email flow, privacy notice, personal-best upsert.
- [ ] Implement Monday UTC rollover and authenticated admin reset with audit record.
- [ ] Add rate limiting, security tests and failure-state UI.

**Done when:** Top 100 displays real verified runs; fake client scores and unauthorized resets are rejected; email is private.

### M6 — Embed, QA, deployment, handoff

- [ ] Add iframe integration example and deployment guide.
- [ ] Validate on major desktop/mobile browsers and narrow screens.
- [ ] Run test suite, audit performance/accessibility/security, fix critical issues.
- [ ] Complete README, operational/admin docs, asset licenses, known limitations.
- [ ] Build production bundle and document release checklist.

**Done when:** deployment is reproducible, all MVP acceptance criteria pass, and a reviewer can integrate the game.

## 13. Definition of done (every milestone)

A milestone is complete only if: (a) code is committed or otherwise reviewable; (b) relevant automated tests are added/passing; (c) manual smoke test is documented when UI is changed; (d) lint/types/build pass; (e) no known blocker prevents normal use; (f) documentation and this roadmap are updated; and (g) remaining problems are listed honestly.

## 14. Out-of-scope change control

Any requested change not already specified must be noted in a **Change Request** with: description, rationale, affected components, estimated effort, risks, and whether it replaces an existing requirement. Get developer approval before implementing a materially scope-expanding feature. Especially avoid spontaneously adding power-ups, accounts, ads, purchase flows, or advanced analytics.

## 15. Questions to confirm with the client

Keep the MVP defaults above unless explicitly changed. Confirm before production handoff:

- [ ] Are the 10 levels and visuals intended as simple branded MVP, or close to premium Royal Match polish?
- [ ] Does the client provide finalized traveler images, coffee tile icons, music/SFX, logo, and rights to use them?
- [ ] Is completion of all 10 levels required for leaderboard eligibility? **Default: yes.**
- [ ] Is leaderboard rank based on cumulative run score, or per-level scores / fastest completion? **Default: cumulative run score.**
- [ ] Should weekly ranking reset exactly Monday at 00:00 UTC? **Default: yes.**
- [ ] What is the intended admin identity/provider and who will own credentials?
- [ ] Does the client want email capture and what are the privacy/retention terms? **Default: optional.**
- [ ] Is the hosting website's iframe integration acceptable, and are there specific CMS, analytics, or CSP constraints?
- [ ] Which browsers/devices must be supported, and are accessibility requirements contractual?
- [ ] Does the client require protection against automated score farming beyond replay verification and rate limiting?
- [ ] How is a player identified across browsers/devices if no account is required? **Default: per-device pseudonymous ID.**
- [ ] Does a manual reset mean creating a fresh active period immediately or clearing only current scores? **Default: new period, retained history.**

## 16. Assumptions and known tradeoffs

1. **Backend complexity:** secure score verification is substantially harder than just accepting a POSTed score. Prioritize integrity; if cost/time forces a tradeoff, explicitly label any weaker anti-cheat design and secure client approval. Never claim a client-trusted scheme is cheat-proof.
2. **Randomness:** deterministic seeded generation/replay is needed for reproducible tests and score verification, but may require shared rules compiled for both client/server or server-side validation in a suitable runtime. Choose and document a concrete approach at M5.
3. **Gameplay balance:** snow coordinates and move caps are provisional. Real balancing requires playtesting and simulation.
4. **No universal unique nickname:** player identity is per browser/device by default; nickname collisions are allowed, and duplicate devices may appear independently. Consider verified accounts only if requested.
5. **Loss of local storage:** game can still start; local progress may be lost; do not misrepresent it as a server-backed account.
6. **Offline:** gameplay may continue after initial load while leaderboard requires connectivity; offline service worker is not required.
7. **Accessibility:** keyboard interactions and clear text labels should be supported where reasonably practical; do not advertise full WCAG compliance without auditing it.
8. **Deployment:** actual domain, environment IDs, credentials and artwork are unknown; never invent them.
9. **CI deferred (2026-11-06):** the user does not currently need remote execution. Local checks are sufficient for M0 acceptance; CI setup and a successful remote run remain deferred.

10. **M1 bounded generation (2026-11-06):** the pure generator supports integer boards of at least 2×3 or 3×2 with 3–6 colors (production levels use 8×8 and 5–6). Unsupported configurations and invalid attempt limits throw `RangeError`. After bounded shuffle attempts, tile colors may be regenerated; the original color multiset is not guaranteed, but cell snow and move/score counters are preserved. After 100 cascade steps, a deterministic safety reshuffle stabilizes the board without awarding points for the reshuffle itself. `BoardState.rngSeed` is the current RNG state, not the original run seed. M2 must integrate this engine; the existing browser scene still has a known post-move input lock.

11. **M2 temporary free play (2026-11-06):** the browser uses an 8×8, five-color, snow-free endless board with seed 12345. `simulateMove(..., { endless: true })` skips move consumption and victory/defeat/remaining-move bonuses while retaining cascades, score and automatic reshuffle. Default level behavior is unchanged. Independent cascade frames drive rendering. Snow levels, run progression and persistence remain M3; basic pause and reduced-motion support are included for scene usability. Browser checks use desktop/mobile Chromium emulation; real-device and cross-browser QA remain M6.

## 17. Progress log

Codex should append brief factual updates in this format after completing meaningful increments:

```text
YYYY-MM-DD — Mx / task: summary
Files: ...
Checks: command → result
Known issues / next step: ...
```

2026-11-05 — M0 / repository foundation: Scaffolded Phaser 3 + TypeScript + Vite project with full tooling
Files: package.json, tsconfig.json, vite.config.ts, eslint.config.js, .prettierrc, vitest.config.ts, playwright.config.ts, .gitignore, .env.example, index.html, src/main.ts, src/styles/main.css, src/game/scenes/BootScene.ts, src/game/scenes/GameScene.ts, README.md, tests/unit/board.test.ts, tests/e2e/game.spec.ts
Checks: npm install → ok; npm run typecheck → ok; npm run lint → ok; npm run test → 13 passed; npm run build → ok; npm run test:e2e → 10 passed (Chromium + Mobile Chrome)
Known issues / next step: Firefox/WebKit require system deps (npx playwright install-deps). Ready for M1 — Pure Match-3 engine.

2026-11-06 — M0 / acceptance: Accepted repository foundation based on local verification; user deferred CI as unnecessary for the current local workflow.
Files: PROJECT_SPEC.md, README.md
Checks: prior local audit on 2026-11-05 → clean install, lint, typecheck, build, 13 placeholder unit tests and 10 Playwright tests passed; GameScene loaded at widths 320/375/768/1280 without JavaScript errors or horizontal overflow. Documentation-only update; checks not rerun.
Known issues / next step: CI is deferred, not implemented or verified. Unit tests are scaffolding only; mobile HUD overlap and limited browser assertions remain for later scene/testing work. M1 has not started.

2026-11-06 — Scene layout / user-requested visual revision: Reserved a separate HUD area, fit the board to the remaining viewport, and relayout on resize/orientation changes. Replaced individual tile backgrounds with one translucent board surface and thin light-beige dashed cell dividers. Corrected scaled pointer mapping and duplicate selection handling.
Files: src/main.ts, src/game/scenes/BootScene.ts, src/game/scenes/GameScene.ts, tests/e2e/game.spec.ts
Checks: npm run lint → passed; npm run typecheck → passed; npm test → 13 placeholder tests passed; npm run build → passed (existing Phaser chunk-size warning); npm run test:e2e -- --reporter=line → 12 passed. New browser checks cover board/HUD separation, viewport containment, and cell selection after resizing at 320/375/768/1280 px and 667×375 landscape. Screenshot smoke review at 836×648 and 375×667 → board fully visible, HUD unobstructed; no JavaScript errors at these sizes or 667×375.
Known issues / next step: Existing gameplay logic and placeholder unit coverage remain provisional; this visual revision does not complete M1–M4. CI remains deferred.

2026-11-06 — M1 / Pure Match-3 engine: Implemented pure TypeScript game logic module (src/game/logic/) with seeded RNG, match detection, board generation, resolution with cascades, reshuffle, and scoring. All 84 unit tests pass.
Files: src/game/logic/types.ts, rng.ts, matches.ts, resolve.ts, generate.ts, reshuffle.ts, index.ts; tests/unit/logic/*.test.ts (7 test files)
Checks: npm run typecheck → passed; npm run lint → passed; npm run test → 84 tests passed; npm run build → passed; npm run test:e2e → 12 tests passed
Known issues / next step: Logic module ready for integration into GameScene for M2. Level configurations 2-10 need final snow coordinates.

2026-11-06 — M1 / Review corrections: Replaced rejection-only generation with match-free construction and a guaranteed legal-swap fallback, including tile colors under snow. Safe reshuffle now regenerates colors after bounded attempts instead of returning an invalid board, preserving cell snow and counters. Added integer bounds checks, swapped-tile match validation, exhausted-move rejection, current RNG-state persistence, and a 100-step cascade safety reshuffle. Corrected existing pure-model snow handling (cell-bound, one layer per clear) and limited cascade multipliers to tile points. No browser scene changes were made in this increment.
Files: src/game/logic/{generate,reshuffle,matches,resolve,index,types}.ts; tests/unit/board.test.ts; tests/unit/logic/{generate,integration,resolve}.test.ts; README.md; PROJECT_SPEC.md
Checks: npm test → 101 passed across 7 files (all 13 placeholder tests replaced). Seeded invariants cover 1000 seeds each for 5/6-color generation, 1000 each for normal/forced-fallback reshuffle, 100 seeds each for four fallback board shapes, and replay simulations up to 25 moves for each of 100 seeds. Constant-RNG cascade termination, impossible multisets, incomplete boards, snow preservation and malformed swaps are covered. npm run typecheck → passed; npm run lint → passed; npm run build → passed (existing Phaser chunk-size warning); npm run test:e2e -- --reporter=line → 12 passed.
Known issues / next step: M1 is verified as a pure engine. M2 must integrate it and replace legacy scene logic, including the confirmed post-move input lock. Browser tests currently cover loading/layout/selection, not completed gameplay. M3 still owns complete level configurations, progression and balancing. CI remains deferred. Earlier M1 acceptance results above are superseded by this correction entry.

2026-11-06 — M2 / Playable scene and controls: Replaced legacy scene logic with M1 simulation and independent cascade frames. Added endless Free Play, mouse/touch swipes, two-tap swaps, selection, keyboard swaps, sequential swap/revert/clear/fall/refill animations, processing lock, pause, reduced motion and visible loading/board errors. Retained the continuous board surface and dashed dividers. Removed duplicate canvas centering and observed container size to correct stale Phaser dimensions after mobile orientation changes.
Files: src/game/scenes/{GameScene,BootScene}.ts; src/game/logic/{types,resolve,index}.ts; src/main.ts; tests/unit/logic/playback.test.ts; tests/e2e/game.spec.ts; README.md; PROJECT_SPEC.md
Checks: npm run lint → passed; npm run typecheck → passed; npm test → 102 passed across 8 files, including 200 endless-model moves and independent cascade playback; npm run build → passed (existing Phaser chunk-size warning); npm run test:e2e -- --reporter=line --workers=1 → 20 passed (2.3m). Browser coverage includes invalid revert, input lock, engine/display parity, native touch swipe at 320px, 40 consecutive moves in each profile, pause, keyboard swap, resize during animation, canvas containment and no horizontal overflow at 320/375/768/1280 and landscape 667×375. Manual desktop browser smoke at 1280×720: two taps cleared matches, refilled the board, updated score and returned to playable state; HUD and board remained distinct.
Known issues / next step: M2 accepted. Temporary endless mode has no snow, move limit or win/lose screen. M3 owns ten complete level configurations, goals, progression, persistence and balancing. Mobile Chrome is emulated Chromium; real-device/Safari/Firefox QA remains M6. CI remains deferred.

## 18. First Codex prompt

Copy this instruction into Codex after placing `PROJECT_SPEC.md` in the repository root:

> Read `PROJECT_SPEC.md` in full and inspect the repository. Treat it as the source of truth. Start with **M0** only. Briefly describe your implementation plan, then scaffold the Phaser 3 + TypeScript + Vite project with tests, lint, typecheck, and a minimal responsive scene using placeholder assets. Run the available checks, document actual results, and check off only completed M0 tasks in `PROJECT_SPEC.md`. Do **not** start M1 or build the leaderboard yet. Keep all code and comments in English.
