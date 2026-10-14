# Civihelp — CODE VAULT 2026 hackathon

Civic complaint routing + accountability for Indian cities (Coimbatore pilot, EN + Tamil).
The user is the reviewer; Claude is the engineer. Deadline 15 Oct 2026, 7:00 AM IST.
- Spec: `PRD.md` (look up sections by heading; never read whole). API: `docs/API.md`.
- Plan + progress: `docs/BUILD_PLAN.md`. Setup deps: `backend/requirements.txt`.

## Session start
1. Read the Progress table in `docs/BUILD_PLAN.md`. Take the first WP that is `doing` or `todo`.
2. Check usage (get_usage). Stop at ~90% of the 5-hour limit: commit `WIP WPn: …`, mark row `doing` with a note.
3. Read only the files the WP touches. Do it, run its Check, commit `WPn: <summary>`, mark `done` + hash.
4. Report in ≤5 lines.

## Rules
- Hackathon rules: build only in the event window; disclose all AI tools, libraries, APIs in README; commit often.
- Cost ₹0: no paid APIs. AI = local `intfloat/multilingual-e5-small` (backend/models/, gitignored).
- One worker at a time; agents only with `model: sonnet`/`haiku`.
- Never commit `backend/civic.db`, `.audit_key`, `.session_key`, `uploads/`, `models/`, `.venv/`.
- Name: Civihelp — lives in `frontend/src/brand.js`, `backend/engine.py` APP_NAME, `frontend/index.html`.
- Commands: tests `cd backend && .venv/Scripts/python -m pytest -q`; reseed `backend/.venv/Scripts/python backend/seed.py`; build `cd frontend && npm run build`; run: Browser preview "civihelp" (`.claude/launch.json`, serves frontend/dist on :8000 — rebuild frontend to see UI changes, restart preview for backend changes).
- Ask before: public GitHub push, deleting data, deps > ~50 MB.
- Keep replies short. Batch independent commands.
