# Build plan — CODE VAULT 2026 (deadline 15 Oct, 7:00 AM IST)

## Progress (update after every WP)

| WP | Name | Status | Commit |
| --- | --- | --- | --- |
| 1 | Backend core: routing, duplicates, state machine, audit chain, OTP login | done | a7ffed0 |
| 2 | Frontend v1: all resident + staff pages | done | 754c308 |
| 3 | Labelled dataset + evaluation metrics + tuning | done | ffd3ed4 |
| 4 | Security audit + code review fixes | done | 6b0c4eb |
| 5 | Auto-assign, polish, public board API, demo reset API | done | a055041 |
| 6 | 35 API tests + lockout/deadline fixes | done | 45f1711 |
| 7 | UI redesign (board, about, offline map, GSAP, reset button) | done (finished in WP8) | a5f20c2 |
| 8 | Visual check + finish UI redesign | done — 12 pages × desktop+mobile, no overflow/errors; fixed eval mobile overflow; offline map verified (?offline) | 00f100a |
| 9 | Red-team attack (judge + attacker) and fixes | done — security checks passed, no holes; animation stall bugs fixed | 2bef1b4 |
| 10 | Full demo-script run (Playwright) | done — steps 1–8 pass, no console errors | 2bef1b4 |
| 11 | Name decided → rename to Civihelp + logo | done — pin+check logo (favicon + header) | see log |
| 12 | README (setup, features, metrics, Credits & AI disclosure) | moved to WP26 | |
| 13 | Public GitHub push | done — github.com/claudecoder101/civihelp | 237a123 |
| 14 | PPT | todo — after 06:00 | |
| 15 | Rehearsal fixes | dropped (no video) | |
| 16 | UI pass: dim theme, glow, glass, chart entrances | done | 0f67239 |
| 17 | v2 logo (அ + A bubbles) + loading screen + landing + main menu | done | see log |
| 18 | App shell: sidebar + top bar (citizen + staff); remove staff↔public links | done | see log |
| 19 | Demo login: 4 profiles, mock Aadhaar, staff auto-OTP (~3 s, Skip), separation, Your access; reporting needs login | done — Playwright: gate, refusal, 3 profiles, skip 93 ms | see log |
| 20 | Dispatch trail + Dispatch page + My work + guides | done — 36 tests pass; trail from audit log | see log |
| 21 | AI match panel | done | see log |
| 22 | 30% reporter quorum (backend + tests + UI) | done — 38 tests pass; seed reaches quorum | see log |
| 23 | Try-a-sample buttons (Report, Track) | todo | |
| 24 | Scroll reveals + CSS 3D tilt | todo | |
| 25 | Playwright run of all v2 flows, fixes, reseed | todo | |
| 26 | README + API docs + final push | todo | |

**Decisions (15 Oct, 01:05):** ask user before each WP · WP9 red-team inline by main session · WP14 = claude.ai Slides artifact · README screenshots captured by Claude via built-in browser.
**Decisions (15 Oct, 01:12):** next session = Playwright plugin. Order: bug sweep every page (Playwright) → WP9 red-team → README → PPT (Slides artifact) last. No video. GitHub: no repo exists yet (only claudecoder101/ICS) — ask user name + public/private once, then push after every commit. AI status: e5 dup F1 0.85 vs 0.26 baseline, routing top-1 93.5% — done, no tuning.

## Work packets

**WP8: Visual check + finish UI redesign.**
Do: open every page at 1366×768 and 375 px (get_page_text first, screenshots only where layout matters). Pages: `/`, `/about`, `/board`, `/track/:id`, `/staff/login`, triage, issues, issue detail, dashboard, hotspots, evaluation, audit (Verify chain + Reset demo). Fix broken layout, overlapping text, console errors. Confirm offline map fallback (block tiles via JS or devtools).
Check: `npm run build` clean; no console errors; demo steps 1–8 (PRD §9) click through.

**WP9: Red-team.**
Do: one read-only review as a hostile judge (weak claims, missing requirements, confusing UX) and attacker (auth, privacy, injection). Fix what is real.
Check: `pytest -q` passes; fixes listed in ≤5 lines.

**WP10: Demo run.** (Playwright plugin — re-enabled 15 Oct 01:03; built-in browser as fallback)
Do: built-in browser (get_page_text + JS checks) walks PRD §9 demo end to end; note slow steps (first AI load, evaluation cache).
Check: two clean runs from fresh `python backend/seed.py`.

**WP12: README.** Setup in ≤5 commands, screenshots, architecture, metrics table, demo accounts, limitations, **Credits & Disclosure** (Claude Code / Claude Opus 5.5, ChatGPT brief, e5 model, every library, OSM tiles, research sources).

## Claude Code workflow (token-efficient, usage-aware)

- **One worker at a time.** No parallel agents. If an agent is used, `model: sonnet` (haiku for lookups); main session reviews.
- **Continuous run** WP after WP until ~90% of the 5-hour limit (check with get_usage before each WP). Then commit `WIP WPn: <state>`, set row to `doing` + note, stop.
- **After a reset** the user says "continue the build": read `CLAUDE.md` + this table only, take the first `doing`/`todo` WP.
- Prefer get_page_text over screenshots; don't re-read files just written; PRD lookups by section (grep), never a full read.
- One commit per WP: `WPn: <summary>`. Reports ≤5 lines.
- Ask the user before: public push, deleting data, new deps > ~50 MB.
