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
| 9 | Red-team attack (judge + attacker) and fixes | todo | |
| 10 | Playwright run of full demo script + speed check | todo | |
| 11 | Name decided → rename (brand.js, engine.APP_NAME, index.html) + logo | todo — waiting on user | |
| 12 | README (setup, features, metrics, Credits & AI disclosure) | todo | |
| 13 | Public GitHub push | todo — needs user OK | |
| 14 | PPT | todo — last, per user | |
| 15 | Rehearsal fixes + backup video notes | todo | |

## Work packets

**WP8: Visual check + finish UI redesign.**
Do: open every page at 1366×768 and 375 px (get_page_text first, screenshots only where layout matters). Pages: `/`, `/about`, `/board`, `/track/:id`, `/staff/login`, triage, issues, issue detail, dashboard, hotspots, evaluation, audit (Verify chain + Reset demo). Fix broken layout, overlapping text, console errors. Confirm offline map fallback (block tiles via JS or devtools).
Check: `npm run build` clean; no console errors; demo steps 1–8 (PRD §9) click through.

**WP9: Red-team.**
Do: one read-only review as a hostile judge (weak claims, missing requirements, confusing UX) and attacker (auth, privacy, injection). Fix what is real.
Check: `pytest -q` passes; fixes listed in ≤5 lines.

**WP10: Demo run.**
Do: Playwright plugin walks PRD §9 demo end to end; note slow steps (first AI load, evaluation cache).
Check: two clean runs from fresh `python backend/seed.py`.

**WP12: README.** Setup in ≤5 commands, screenshots, architecture, metrics table, demo accounts, limitations, **Credits & Disclosure** (Claude Code / Claude Opus 5.5, ChatGPT brief, e5 model, every library, OSM tiles, research sources).

## Claude Code workflow (token-efficient, usage-aware)

- **One worker at a time.** No parallel agents. If an agent is used, `model: sonnet` (haiku for lookups); main session reviews.
- **Continuous run** WP after WP until ~90% of the 5-hour limit (check with get_usage before each WP). Then commit `WIP WPn: <state>`, set row to `doing` + note, stop.
- **After a reset** the user says "continue the build": read `CLAUDE.md` + this table only, take the first `doing`/`todo` WP.
- Prefer get_page_text over screenshots; don't re-read files just written; PRD lookups by section (grep), never a full read.
- One commit per WP: `WPn: <summary>`. Reports ≤5 lines.
- Ask the user before: public push, deleting data, new deps > ~50 MB.
