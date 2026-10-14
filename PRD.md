# PRD — Civihelp: India's accountability layer for civic complaints

> CODE VAULT 2026 (KPRIET × GeeksforGeeks) assigned problem. Coimbatore pilot, English + Tamil.
> **v1** (built 14 Oct 19:00 → 15 Oct 01:45) is complete and working — see §4. **v2** (15 Oct 02:20 → 06:00) changes how people enter the product, how work moves between departments and how it looks — see §6.
> Deadline 15 Oct 2026, 07:00 IST. Cost ₹0: open-source, offline, no paid APIs.

---

## 1. Problem statement

> Citizens file duplicate complaints; complaints have no clear owner, bounce between departments, get closed without work being done, and nobody is accountable for overdue cases. Responsibility rules and explainable confidence are expected.

| # | Problem | Evidence from India |
|---|---|---|
| 1 | **Duplicates** — same issue reported many times, often in different languages | No deployed Indian system links Tamil and English reports of the same problem |
| 2 | **No clear owner** | Complaints sit unassigned |
| 3 | **Bouncing between departments** | Each transfer resets the clock; ownership is lost |
| 4 | **Closed without work** | AP PGRS: 90% "resolved" officially vs **22%** citizen satisfaction (The Wire) |
| 5 | **No accountability for overdue** | BMC Mumbai: only **414 of 13,552** escalated complaints resolved (Praja) |

SDG 16 (16.6 accountable institutions, 16.7 responsive decision-making) · SDG 11 (basic urban services).
Pitch: *"Rules where accountability matters, AI where language gets in the way."*

## 2. What exists today (research)
| System | What it does | What it misses |
|---|---|---|
| **CPGRAMS** (national) | 21-day deadline, feedback call, appeal, EN/HI dedup | No cross-language dedup; closures with "approach another agency" |
| **Swachhata (MoHUA)** | Photo complaint + "resolved" photo, 12 h deadline | No dedup; fake "resolved" photos |
| **Chennai 1913 / Namma Chennai** | App + helpline, reopen up to 2× | Premature closures, no visible history |
| **Coimbatore CCMC / Namma Kovai** | App, WhatsApp, SMS, officer rating | No dedup, no public resolution data |
| **BBMP Sahaaya** | Received/assigned/transferred states | Repeat reports only prioritised; false closures |
| **BMC Mumbai** | 4-level escalation | 414 of 13,552 escalations resolved |
| **AP PGRS** | AI hotspots | 90% vs 22% gap |
| **FixMyStreet** (UK) | Nearby reports before submit; "follow" | Location + category only, no text |
| **NYC311** | Open data | Closes duplicates → original left unresolved |
| **Salesforce Einstein (Denver 311)** | Confidence tiers | Needs large labelled history |
| **Past hackathons (SIH 2025, DARPG 2024)** | Photo+GPS, LLM category, upvotes | No measured accuracy, audit trail, routing reasons, SLA model or Tamil↔English dedup |

**Gaps nobody fills:** cross-language duplicate linking · fake closures · ownership lost on transfer · escalation that goes nowhere · no published accuracy.

## 3. What makes Civihelp different
1. **Tamil ↔ English duplicate linking** with meaning %, distance and time shown separately.
2. **Duplicates linked, never closed** — every reporter tracks one issue and gets every update; more reports raise priority.
3. **Verified closure by citizens** — resolve needs reason + evidence; the issue closes only when **30% of its reporters** confirm (v2). Closure rate vs citizen-verified rate shown side by side.
4. **Ownership never lost** — dispatch trail shows every hop as *sent* and *received*; rejecting needs a reason and a new owner; bounces counted publicly.
5. **Tamper-evident audit log** — SHA-256 hash chain; edit a DB row live and verification fails on screen.
6. **Routing with confidence tiers + reasons** — high: auto-assign; medium: confirm; low: Needs review with top-3.
7. **Measured, not claimed** — live Evaluation page, AI vs no-AI.

## 4. Done — v1 (working, tested)

| Area | What works | Where |
|---|---|---|
| Intake | EN/TA text, category chips, map pin (Leaflet/OSM, offline fallback), landmark, photo, phone → tracking ID `CV-xxxx-XXXXXX` | `pages/Report.jsx`, `POST /api/reports` |
| Duplicates (AI) | `intfloat/multilingual-e5-small` locally; candidates ≤300 m, ≤7 days; meaning + distance + time; "Already reported nearby?" + Follow | `engine.py`, `/api/reports/check` |
| Routing | Versioned rules + EN/TA keywords + ward coverage → top-3, tier, reasons | `engine.py`, `pages/Triage.jsx` |
| State machine | Triage → Assigned → Acknowledged → In progress → Resolved → Closed; Rejected/Reassigned, Escalated, Reopened; role permissions | `workflow.py` |
| Deadlines | Per-category targets, "why this due time", auto-escalation | `workflow.py` |
| Verified closure | Reason + evidence; citizen confirm/reopen | `Track.jsx`, `/api/reports/{id}/confirm` |
| Audit | Append-only (SQLite triggers), hash chain, Verify, tamper script | `db.py`, `tamper.py`, `Audit.jsx` |
| Staff login | Directory-only mobile + OTP (hashed, 5 min, 3 tries, 30 s resend, lockout), signed 8 h session, role + dept checks; SMS simulated via `send_sms()` | `auth.py` |
| Dashboards | Ops KPIs, closure vs verified gap, charts, hotspot map, public City Board | `Dashboard.jsx`, `Hotspots.jsx`, `Board.jsx` |
| Evaluation | 120 labelled reports: dup F1 **0.85 vs 0.26** TF-IDF, routing top-1 **93.5%**, latency, overdue rate | `metrics.py`, `Evaluation.jsx` |
| Interop | `GET /open311/requests.json` | `app.py` |
| Security check (15 Oct) | Staff APIs 401 without login; reset protected; empty/huge/out-of-range input rejected; fake ID 404; injected HTML stored as text | — |
| UI (15 Oct) | Dim slate theme, drifting glow, glass cards, hollow meters, chart entrances, compact spacing; animation fallbacks fixed | `index.css`, `anim.jsx` |
| Quality | 35 pytest tests; Playwright demo run passes; no console errors; no overflow at 375 px | `backend/tests` |

## 5. Design review of v1

**Keep:** EN/Tamil toggle and bilingual citizen pages · "Already reported nearby?" panel · dashboard "Closed is not the same as fixed" hero · navy staff sidebar · audit chain visual · honest evaluation labels.

| Problem | v2 fix |
|---|---|
| Logo goes to the report form; no landing page | Logo → Landing; new entry flow (§6.1) |
| "Staff login" in the public nav; staff ↔ public pages link into each other | Separate areas entered from the Main menu; cross-links removed |
| Demo staff directory + SMS inbox clutter the login | 4 demo profile buttons + animated auto-login (§6.3) |
| Hard to see where an issue is between departments | Dispatch trail with Sent / Received (§6.4) |
| AI matching invisible unless you open Triage | AI match panel (§6.5) |
| One citizen closes an issue for everyone | 30% reporter quorum (§6.6) |
| Citizen (top nav) and staff (sidebar) feel like two products | One shell: sidebar + top bar (§6.2) |
| No guidance for staff | Inline how-to guides (§6.4) |
| Generic logo | Two merging speech bubbles (அ + A) with a check (§6.8) |

## 6. v2 features

### 6.1 Entry flow
1. **Loading screen** (≤1.5 s, skippable, once per session): Tamil and English bubbles slide together, merge, check mark draws.
2. **Landing** (`/`): pitch, 3 animated proof points, live City Board numbers, scroll reveals, CSS 3D tilt hero. **Enter** → Main menu; secondary: City Board, How it works.
3. **Main menu** (`/start`): **Citizen** and **Staff** cards. `ENG | தமிழ்` appears here and stays in the top bar.

### 6.2 App shell
- **Left sidebar:** sections + primary action (Citizen: Report an issue; Staff: Triage queue / My work). Drawer under 768 px.
- **Top bar:** title + breadcrumb, `ENG | தமிழ்`, profile chip (name, role, dept), Sign out.
- Citizen: Report · My reports · Track · City Board · How it works.
- Staff (per role): Triage · My work · Dispatch · All issues · Dashboard · Hotspots · Evaluation · Audit.
- 8-px spacing scale, 15–16 px text, 44 px targets, focus rings, WCAG AA.

### 6.3 Demo login (simulated identity, no real data)
- Choice: **Citizen login | Staff login**. Four profile buttons:
  | Profile | Type | Access |
  |---|---|---|
  | Priya S. (RS Puram, writes Tamil) | Citizen | Report, my reports, track, confirm/reopen |
  | Arun K. (Gandhipuram, writes English) | Citizen | Same; owns the linked English report |
  | P. Lakshmi Priya | Staff · Solid Waste (officer) | Own dept queue, acknowledge, resolve |
  | R. Kavitha | Staff · Grievance Cell (triage) | Triage, route, link duplicates |
- **Citizen:** simulated Aadhaar step — masked mock number (`XXXX XXXX 4821`) + mock OTP; label *"Simulated — no Aadhaar data is requested or stored."* No Aadhaar input field.
- **Staff:** real mobile + OTP backend, auto-typed: number types → OTP sent → ~3 s → code types from demo inbox → signed in. **Skip** = instant.
- **Separation:** staff number at Citizen login → refused ("use Staff login"); citizens can't open staff routes.
- **Reporting requires citizen login** (blocks spam/fake reports). Tracking by ID stays public.
- After login: **"Your access"** card — what this profile can see/do + assigned work count.

### 6.4 Dispatch tracking
- **Dispatch trail** per issue (staff detail; simplified on citizen track): one row per hop — `From → To · Sent <time> · Received <time> by <officer> · Next: <step> (due …)`. *Sent* = assigned/reassigned event; *Received* = acknowledged by receiving dept; pending shows *Awaiting receipt* + timer, overdue in red. Chips open the audit event (who, when, reason, hash).
- **Header facts:** submitted by (alias + linked-reporter count), current owner (dept + officer), current step, next step.
- **Dispatch page:** *Sent, not yet received* · *Received, not yet acted on* (for the officer's dept).
- **My work:** the dept's items grouped by next step.
- **Guides** (collapsible, 3 steps each): how to send, receive, track.
- Permissions shown plainly; unavailable actions hidden with a one-line reason.

### 6.5 AI match panel (no translation)
- Tamil and English texts side by side, badge `AI · multilingual meaning match · 91%`, distance, time apart.
- Note: *"The model compares meaning across Tamil and English directly; matching reports merge into one issue that every reporter tracks."*
- Linked-reporters list with how each was linked (auto / staff / citizen followed).

### 6.6 Verified closure by quorum
- Resolved → Closed (citizen-verified) when **ceil(30% × linked reporters)** confirm (min 1). Shown as `1 of 3 confirmations needed`. Any reporter can reopen with a note (reopen wins). Backend + tests.

### 6.7 Demo helpers
- Report: *Try a sample* (Tamil / English — same bin, shows the live match). Track: sample IDs (open, awaiting confirmation, closed).

### 6.8 Visual design
- Logo: two bubbles (அ, A) merging with a check; navy + saffron/green. Favicon, header, loading screen.
- Theme: current dim slate + glass, compact. GSAP scroll reveals, CSS 3D tilt, reduced-motion respected. No new libraries.
- All new screens bilingual (Tamil written by Claude; spot-check by team).

### 6.9 Repo + docs
- Root `README.md` (problem, features, screenshots, setup, demo profiles, metrics, architecture, **Credits & AI disclosure**), `backend/requirements.txt`, remove Vite boilerplate, update `docs/API.md`. Public repo `claudecoder101/civihelp`, push after every work packet.

## 7. Tech
| Layer | Choice |
|---|---|
| Backend | FastAPI + SQLite (stdlib), Python 3.12 |
| AI | sentence-transformers + `intfloat/multilingual-e5-small`, CPU, offline after one-time download |
| Frontend | React 19 + Vite + Tailwind 4, React Router, Leaflet (OSM), Recharts, GSAP |
| Tests | pytest (routing, duplicates, transitions, hash chain, metrics, API); Playwright for UI flows |

## 8. Hackathon rules compliance
| Rule | How |
|---|---|
| Built in the event window | Repo created after 19:00, 14 Oct; no prior code |
| No plagiarism | Original code; open-source libraries only |
| Disclose AI, frameworks, APIs, libraries | README "Credits & Disclosure": Claude Code (Claude Opus 5.5), ChatGPT (brief), e5 model, every library, OSM tiles, research sources |
| Meaningful progress | Commit + push after every work packet |
| No late submission | Code freeze 06:00, submit before 07:00 |
| Deliverables | Public repo · README · working demo · PPT |

## 9. Judging map
| Criterion | What judges see |
|---|---|
| Problem & SDG | Every clause of the statement → a working feature; SDG 16 + 11; real Indian data |
| Technical | Live loop, hash-chained audit, OTP login, state machine, dispatch trail, tests passing |
| Innovation | Tamil↔English linking, 30% citizen quorum, tamper-evident log |
| Impact & feasibility | ₹0, AI and data run locally on a laptop (works without internet after setup; map tiles fall back to a grid), Open311 endpoint, plugs into existing portals |
| Presentation | Loading → landing → demo profiles; "break the chain live"; Evaluation numbers |

PPT (8 slides): Problem with data → Who suffers → What exists & gaps → Civihelp → Live demo → Measured results → Impact & scale-up → Team + disclosure.

## 10. Demo script (3 min, v2)
1. Loading → Landing → Enter → Main menu → switch to தமிழ்.
2. Citizen Priya (simulated Aadhaar) → Try a sample (Tamil) → tracking ID.
3. Citizen Arun → English sample → "Already reported nearby" shows Priya's → Follow.
4. Staff Kavitha (auto-OTP) → Triage: AI match panel, routing reasons, Needs review case.
5. Staff Lakshmi Priya → Dispatch: received → acknowledge → resolve with evidence.
6. Priya confirms → `1 of 1 needed` (30% of 2) → Closed (citizen-verified).
7. Audit → tamper → Verify fails. Dashboard gap. Evaluation metrics.

## 11. Out of scope (README "Future work")
Real Aadhaar/DigiLocker/SSO, real SMS/WhatsApp, rate limiting per citizen, machine translation, voice intake, image similarity, full State→District→ULB hierarchy, DPDP review, live government integration, three.js 3D.

## 12. Acceptance checks
- `pytest` passes (existing 35 + quorum tests); `npm run build` clean; no console errors.
- Playwright: entry flow; 4 demo logins; citizen ↛ staff routes; staff number refused at citizen login; report → duplicate → follow; dispatch sent/received; quorum close; audit verify.
- 375 px no horizontal scroll; keyboard navigation; reduced motion respected.
- Fresh clone → README steps work.
