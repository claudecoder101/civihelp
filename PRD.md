# PRD — CivicResolve: India's accountability layer for civic complaints

> CODE VAULT 2026 assigned problem. Merges the official statement, the ChatGPT brief, and Opus research (3 agents, 9:25 PM) on 13 Indian systems, 12 global platforms, academic work and past hackathons. On approval: saved as `PRD.md`, first commit.

---

## 0. Decisions
- **One AI model:** cross-language duplicate detection, `intfloat/multilingual-e5-small` (covers Tamil; MiniLM dropped — not trained on Tamil). Validate on 20 hand-made Tamil/English pairs first (15 min); fallback `l3cube-pune/indic-sentence-similarity-sbert`; final fallback TF-IDF.
- **Routing stays rule-based + explained** (statement asks for responsibility rules + explainable confidence).
- **Hotspot map** kept. Overdue prediction and Claude-API intake dropped.
- **Design built with each page** (frontend-design), polish pass at end.
- **Ask before anything major** (deps >~50 MB, delete, push public, deploy). Report changes after each milestone. Commit + push often.
- **Teammates:** no faked commits; they get real tasks (PPT, testing, presenting).
- **Model:** Opus 5.5 main session; subagents `model: opus`.
- **Cost:** ₹0 — all open-source, offline, no API keys.

## 1. Problem
Citizens file duplicate complaints; complaints have no clear owner, bounce between departments, get closed without work being done, and nobody is accountable for overdue cases.

## 2. What exists today (research)
| System | What it does | What it misses |
|---|---|---|
| **CPGRAMS** (national) | 21-day deadline, feedback call after closure, appeal, IGMS analytics with English/Hindi dedup | No cross-language dedup; Parliament flagged closures as "approach another agency" / no reason |
| **Swachhata (MoHUA)** | Photo complaint + "resolved" photo, 12 h sanitation deadline | No dedup; fake "resolved" photos reported |
| **Chennai 1913 / Namma Chennai** | App + helpline, reopen up to 2× | Premature closures, wrong photo as proof, no visible history |
| **Coimbatore CCMC / Namma Kovai** | App, WhatsApp, SMS, officer rating | No dedup, no public resolution data |
| **BBMP Sahaaya** (Bengaluru) | Received/assigned/transferred states | Repeat reports just prioritised; officials caught falsely closing |
| **BMC Mumbai** | 4-level escalation | Only 414 of 13,552 escalated complaints resolved (Praja) |
| **AP PGRS** | AI hotspots announced | 90% "resolved" officially vs **22%** citizen satisfaction (The Wire) |
| **FixMyStreet** (UK) | Shows nearby same-category reports before submit; "follow" instead of re-filing | Location + category only, no text, no escalation |
| **NYC311** | Huge open data | Closes duplicates as "Duplicate" → original left unresolved |
| **Singapore OneService** | AI routing across agencies | One-tier government; self-reported numbers |
| **Salesforce Einstein (Denver 311)** | Confidence tiers: auto / confirm / top-3 | Needs large labelled history |
| **Past hackathons (SIH 2025, DARPG 2024)** | Photo+GPS, map pins, LLM category, upvotes, chatbot, voice | **None show measured accuracy, audit trail, routing explanations, SLA model, or Tamil↔English dedup** |

**Gaps nobody fills:** cross-language duplicate linking · fake closures · ownership lost on transfer · escalation that goes nowhere · no published accuracy.

## 3. What makes CivicResolve different
1. **Tamil ↔ English duplicate linking** — a Tamil and an English report about the same bin are linked to one issue, with meaning %, distance and time shown separately. No deployed system does this.
2. **Duplicates are linked, never closed** — every reporter follows the issue and gets every update; more reports raise its priority. (Fixes NYC311's failure.)
3. **Verified closure** — "Resolved" needs a closure reason + evidence note; the citizen confirms or reopens. Dashboard shows **closure rate vs citizen-verified rate** side by side. (Fixes AP's 90% vs 22%.)
4. **Ownership never lost** — rejecting requires a reason and a new owner who must accept; bounce count tracked as a metric.
5. **Tamper-evident audit log** — every status change is hash-chained to the previous one; "Verify chain" button; edit a row in the DB live and the chain breaks on screen.
6. **Routing with confidence tiers + reasons** — high: auto-suggest; medium: officer confirms; low: "Needs review" with top-3. Every suggestion explains itself.
7. **Measured, not claimed** — live Evaluation page with standard metrics on a labelled set, and AI vs no-AI comparison.

Pitch line: *"Rules where accountability matters, AI where language gets in the way."*
SDG 16 (16.6 accountable institutions, 16.7 responsive decision-making) · SDG 11 (basic urban services).

## 4. Pilot scope
- Coimbatore (fictional 10-ward map, labelled demo data). Non-emergency only ("Emergency? Call 112").
- 5 categories: Roads/Pothole · Garbage · Streetlight · Drainage · Water. 5 departments + Manual Triage.
- English + Tamil input; original text stored.
- **Login (staff): registered government mobile number + OTP.** Only numbers in the admin-maintained **official staff directory** (name, designation, department, ward, role) can log in — unknown numbers are refused. OTP: 6 digits, stored hashed, expires in 5 min, max 3 attempts, resend cooldown 30 s, lockout after repeated failures. Signed session token (8 h), role + department checked on every API call. Admin can deactivate a number instantly (transfer/retirement). Every login, failed attempt and lockout goes into the audit log. Audit events record the **logged-in officer**, so accountability is real.
- **OTP delivery is simulated** in the demo (shown in a "demo SMS inbox" panel, ₹0). Code has one `send_sms()` function to plug into a real gateway (e.g. NIC/CDAC SMS, MSG91) later — clearly stated in README.
- **Residents: no login required** — submit anonymously, track by tracking ID + optional phone (privacy-by-default, matches CPGRAMS/brief guidance). Optional "My reports" via phone + OTP shown on screen (simulated, no real SMS).
- Demo staff directory (fictional numbers, e.g. `+91 90000 000xx`) seeded in `backend/seed.py` and listed in README.

## 5. Features

**F1 Intake** — description (EN/TA), optional category, map pin (Leaflet), landmark, optional photo, optional contact → tracking ID `CV-0042`. **Before submit:** "Already reported nearby?" list (incl. cross-language) with **Follow this issue** button (FixMyStreet idea, smarter).

**F2 Routing** — versioned rule table (category + ward → lead dept, ack/resolve targets). Score from category rule + EN/TA keywords + ward coverage → top-3 depts with plain-language reasons and confidence tier.

**F3 Duplicates (AI)** — candidates: open issues ≤300 m, ≤7 days (95% of duplicates arrive within 30 days per research; we use 7 for civic issues), compatible category → ranked by e5-small meaning similarity + distance + time. Staff approve; links reversible; who/why recorded. Each extra report raises issue priority.

**F4 State machine + audit** — `Submitted → Triage → Assigned → Acknowledged → In progress → Resolved → Closed`, plus `Rejected→Reassigned`, `Escalated`, `Reopened`. Role-permission table; invalid moves blocked; required fields enforced. Events append-only (SQLite triggers) + SHA-256 hash chain + verify endpoint.

**F5 SLA + escalation** — fictional per-category targets (labelled, not govt standards); each issue shows due time and why; overdue → auto `Escalated` event to supervisor (system actor).

**F6 Notifications (simulated)** — in-app feed per report; all linked reporters notified. No real SMS.

**F7 Verified closure** — resolve requires reason + evidence note; residents confirm or reopen from tracking page.

**F8 Dashboards** — Ops: unassigned, awaiting ack, near SLA, overdue by dept, bounce count. Management: median/P90 ack & resolve time, overdue rate, closure vs verified rate, by dept/category.

**F9 Hotspot map** — clusters sized by report count; ward × category table.

**F10 Evaluation page** (labelled set ~120 reports, tuning/test split):
| Required | Metric |
|---|---|
| Routing accuracy | Top-1, Top-3, macro-F1, confusion matrix |
| Duplicate-cluster quality | Pairwise P/R/F1, B-cubed F1, Recall@5; **e5 vs TF-IDF** |
| Resolution latency | Median, P90 |
| Overdue-case rate | Open past due ÷ open |
Labelled "synthetic data — not real-world results."

**F11 Open311-style endpoint** — `GET /open311/requests.json` (cheap interoperability story).

**Out of scope (README future work):** SSO/Aadhaar/DigiLocker login, real SMS/WhatsApp, voice, image similarity, full State→District→ULB→Panchayat tree (model allows it), DPDP review, live govt integration.

## 6. Tech
| Layer | Choice |
|---|---|
| Backend | FastAPI + SQLite (stdlib) |
| AI | sentence-transformers + `multilingual-e5-small` (CPU, offline after ~1 GB one-time download incl. PyTorch CPU) — **ask before install** |
| Frontend | React + Vite + Tailwind, Leaflet (OSM), Recharts |
| Tests | pytest: routing, duplicates, transitions, hash chain, metrics |

Layout: `backend/` (`app.py`, `engine.py`, `workflow.py`, `metrics.py`, `seed.py`, `tests/`) · `frontend/` (Report, Track, Workbench, Dashboard, Evaluation) · `PRD.md` · `README.md`.

## 6b. Plugins, skills & agents — who does what
| Job | Tool |
|---|---|
| Visual direction (palette, fonts, style for a govt/civic app) | `ui-ux-pro-max` (searches its style/palette/font DB) |
| Building pages | `frontend-design` + `taste-skill: design-taste-frontend` (avoid generic AI look) |
| Components (forms, tables, dialogs, accessible) | `ui-ux-pro-max: ui-styling` (shadcn/ui + Tailwind) |
| Micro-animations (status changes, chain-verify) | `gsap-skills: gsap-react` (light touch) |
| Parallel build | `superpowers: dispatching-parallel-agents` — Opus agents: backend, frontend, seed+metrics |
| Keep scope tight | `ponytail` (always on) |
| Type/import errors while editing | TypeScript + Pyright LSP plugins |
| Pre-commit checks | `checker` agent |
| Quick code lookups | `scout` agent |
| Login/security review | `agent-skills: security-auditor` agent |
| Test coverage of core logic | `agent-skills: test-engineer` agent |
| Code review before final push | `agent-skills: code-reviewer` agent |
| End-to-end demo check + screenshots | Playwright plugin / built-in browser |
| Page speed sanity check | `agent-skills: web-performance-auditor` (only if time) |
| Done = proven | `superpowers: verification-before-completion` |
| PPT | `pptx` skill (or Slides artifact) |
| Not used | `superdesign` (needs its own account/canvas — ask first), `brag`, `figma`/`vercel` (disabled) |

## 7. Hackathon rules compliance
| Rule | How |
|---|---|
| Built within 12 h | Repo created after 7 PM, no prior code |
| No plagiarism | Original code; only open-source libraries |
| Disclose AI/frameworks/APIs/libraries | README "Credits & Disclosure": Claude Code, ChatGPT (brief), e5 model, every library, OSM tiles, research sources |
| Meaningful progress | Commit + push every 30–60 min |
| No late submission | **Submit by 5:00 AM** |
| Deliverables | Public repo · README · working demo · PPT |
| Software only | Web app |

## 8. Timeline (IST)
| Time | Milestone |
|---|---|
| 9:45–10:15 | Repo, PRD.md, scaffold, design direction (ui-ux-pro-max); model download in background; 20-pair Tamil check |
| 10:15–12:15 | Backend + login (Opus agent A): auth, routing, duplicates, state machine, hash chain, SLA, API + tests |
| 10:15–12:45 | Frontend (Opus agent B): login, Report, Track, Workbench — designed as built |
| 10:15–11:45 | Seed data (labelled) + metrics (me / agent C) |
| 12:45–1:45 | Dashboard, hotspot map, Evaluation; wire everything together |
| 1:45–2:45 | Security audit + code review + Playwright end-to-end, fixes, UI polish |
| 2:45–3:30 | README + disclosure, screenshots |
| 3:30–4:45 | PPT, final push, **submit** |
| 4:45–7:00 | Rehearse ×2, backup video, buffer |

**Estimate:** ~6 h build → app done ~2:45 AM, submitted ~4:45 AM, ~2 h buffer before 7:00.

Teammate tasks: PPT from this PRD · test + bug list · presenting.

## 8b. Judging map (each criterion → proof on screen)
| Criterion | What judges see |
|---|---|
| Problem relevance & SDG | Every clause of the statement shown as a working feature; SDG 16.6/16.7 + 11; real Indian failure data (AP 90% vs 22%, BMC 414/13,552) |
| Technical implementation | Live working loop, hash-chained audit, OTP login, state machine, tests passing |
| Innovation | Tamil↔English duplicate linking (no deployed system does it), verified closure, tamper-evident log |
| Impact & feasibility | ₹0 open-source, runs offline on a laptop, Open311-style API, plugs into existing portals instead of replacing them |
| Presentation & demo | 3-min scripted demo with a "break the chain live" moment; Evaluation page with numbers; backup video |

PPT (8 slides): Problem with real data → Who suffers → What exists & gaps → CivicResolve → Live demo → Measured results → Impact & scale-up → Team + disclosure.

## 9. Demo (3 min)
1. Resident A reports overflowing bin in **Tamil** → tracking ID.
2. Resident B starts an **English** report → "Already reported nearby" shows the Tamil one → Follow.
3. Triage: routing reasons + tier; one vague report → "Needs review".
4. Dept acknowledges, updates; seeded overdue case shows escalation.
5. Resolve with evidence → resident confirms (or reopens).
6. Audit timeline → edit DB row → "Verify chain" fails.
7. Dashboard: closure vs verified rate, hotspot map.
8. Evaluation: 4 metrics, AI vs no-AI.

## 10. Verification
- `pytest backend/tests` passes.
- Playwright run of the demo script, no console errors.
- Fresh clone → README steps work.
