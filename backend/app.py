"""CivicResolve API. Run: uvicorn app:app --port 8000 (from backend/)."""
import base64
import os
import secrets
import threading
from datetime import timedelta

from fastapi import Depends, FastAPI, Header, HTTPException, Request
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

import auth
import db
import engine
import workflow
from db import add_event, iso, now, parse

HERE = os.path.dirname(__file__)
UPLOADS = os.path.join(HERE, "uploads")
DIST = os.path.join(HERE, "..", "frontend", "dist")
os.makedirs(UPLOADS, exist_ok=True)

app = FastAPI(title=f"{engine.APP_NAME} API")
_lock = threading.Lock()  # SQLite + a demo server: serialise writes, keep it simple


def get_con():
    with _lock:
        con = db.connect()
        try:
            yield con
        finally:
            con.commit()  # validation happens before writes, so committing on error only keeps audit/login events
            con.close()


@app.exception_handler(auth.AuthError)
@app.exception_handler(workflow.WorkflowError)
def _domain_error(_req, exc):
    return JSONResponse({"detail": str(exc)}, status_code=exc.status)


@app.on_event("startup")
def startup():
    if not os.path.exists(db.DB_PATH):
        try:
            import seed
            seed.reset_and_seed().close()
        except ImportError:
            con = db.connect()
            db.init(con)
            con.close()
    threading.Thread(target=engine.ai_available, daemon=True).start()  # warm the model


def current_staff(authorization: str = Header(default=""), con=Depends(get_con)):
    return auth.staff_from_token(con, authorization.removeprefix("Bearer ").strip())


def require(*roles):
    def dep(staff=Depends(current_staff)):
        if staff["role"] not in roles:
            raise HTTPException(403, "Your role cannot do this")
        return staff
    return dep


# ---------- helpers ----------
WARD_NAMES = {w[0]: w[1] for w in engine.WARDS}
DEPT_NAMES = {k: v[0] for k, v in engine.DEPARTMENTS.items()}


is_overdue = workflow.is_overdue


def report_count(con, issue_id):
    return con.execute("SELECT COUNT(*) FROM links WHERE issue_id=? AND active=1", (issue_id,)).fetchone()[0]


def issue_summary(con, i, t=None):
    t = t or now()
    return {"id": i["id"], "category": i["category"], "dept_id": i["dept_id"], "dept_name": DEPT_NAMES.get(i["dept_id"]),
            "ward": WARD_NAMES.get(i["ward_id"]), "status": i["status"], "priority": i["priority"],
            "report_count": report_count(con, i["id"]), "created_at": i["created_at"], "ack_due": i["ack_due"],
            "resolve_due": i["resolve_due"], "overdue": is_overdue(i, t), "escalated": bool(i["escalated"]) and i["status"] in workflow.OPEN,  # only flag while still open
            "bounce_count": i["bounce_count"], "lat": i["lat"], "lng": i["lng"]}


def get_issue(con, issue_id):
    i = con.execute("SELECT * FROM issues WHERE id=?", (issue_id,)).fetchone()
    if not i:
        raise HTTPException(404, "Issue not found")
    return i


def new_tracking_code():
    return "".join(secrets.choice("ABCDEFGHJKLMNPQRSTUVWXYZ23456789") for _ in range(6))


def get_tracked(con, tracking_id):
    """Public access needs the full tracking ID (CV-0042-K7Q2XM): the secret suffix stops anyone
    enumerating sequential IDs to read, confirm or reopen other people's complaints."""
    rid, _, code = tracking_id.upper().strip().rpartition("-")
    r = con.execute("SELECT * FROM reports WHERE id=?", (rid,)).fetchone() if rid else None
    if not r or not r["token"] or not secrets.compare_digest(r["token"], code):
        raise HTTPException(404, "No complaint with this tracking ID")
    return r


def get_report(con, report_id):
    r = con.execute("SELECT * FROM reports WHERE id=?", (report_id.upper(),)).fetchone()
    if not r:
        raise HTTPException(404, "No complaint with this tracking ID")
    return r


def open_issues_for_dups(con):
    out = []
    for i in con.execute("SELECT * FROM issues WHERE status != 'Closed'").fetchall():
        reps = con.execute("SELECT r.* FROM reports r JOIN links l ON l.report_id=r.id WHERE l.issue_id=? AND l.active=1",
                           (i["id"],)).fetchall()
        out.append({"id": i["id"], "category": i["category"], "status": i["status"], "report_count": len(reps),
                    "reports": [{"text": r["text"], "lat": r["lat"], "lng": r["lng"], "created_at": parse(r["created_at"])}
                                for r in reps]})
    return out


def analyse(con, text, category, lat, lng, at):
    w = engine.ward_for(lat, lng)
    routing = engine.route(text, category, w[1])
    # no category given but routing is confident → use it so unrelated categories aren't offered as duplicates
    cat = category or (routing[0]["category"] if routing[0]["tier"] == "high" else None)
    return {"id": w[0], "name": w[1]}, routing, engine.dup_candidates(text, cat, lat, lng, at, open_issues_for_dups(con))


def pct(values, q):
    v = sorted(values)
    if not v:
        return None
    k = (len(v) - 1) * q
    lo = int(k)
    return round(v[lo] + (v[min(lo + 1, len(v) - 1)] - v[lo]) * (k - lo), 1)


def next_id(con, table, prefix):
    n = con.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0] + 1
    return f"{prefix}-{n:04d}"


# ---------- models ----------
class CheckIn(BaseModel):
    text: str = Field(min_length=3, max_length=2000)
    category: str | None = None
    lat: float = Field(ge=6, le=37)  # India bounding box
    lng: float = Field(ge=68, le=98)


class ReportIn(CheckIn):
    landmark: str | None = Field(default=None, max_length=200)
    contact: str | None = Field(default=None, max_length=100)
    photo_base64: str | None = Field(default=None, max_length=7_000_000)  # ~5 MB image
    follow_issue_id: str | None = Field(default=None, max_length=30)


class ConfirmIn(BaseModel):
    fixed: bool
    note: str | None = Field(default=None, max_length=500)


class MobileIn(BaseModel):
    mobile: str = Field(max_length=20)


class OtpIn(MobileIn):
    code: str = Field(max_length=10)


Short = Field(default=None, max_length=1000)


class CreateIssueIn(BaseModel):
    dept_id: str = Field(max_length=30)
    note: str | None = Short


class LinkIn(BaseModel):
    issue_id: str = Field(max_length=30)
    reason: str | None = Short


class UnlinkIn(BaseModel):
    reason: str = Field(min_length=3, max_length=1000)


class TransitionIn(BaseModel):
    to: str = Field(max_length=30)
    reason: str | None = Short
    public_note: str | None = Short
    closure_reason: str | None = Field(default=None, max_length=60)
    evidence: str | None = Short
    new_dept_id: str | None = Field(default=None, max_length=30)


def check_category(c):
    if c is not None and c not in engine.CATEGORIES:
        raise HTTPException(400, "Unknown category")


# ---------- public ----------
@app.get("/api/meta")
def meta():
    return {"categories": [{"id": k, "name": v[0], "name_ta": v[1]} for k, v in engine.CATEGORIES.items()],
            "departments": [{"id": k, "name": v[0], "name_ta": v[1]} for k, v in engine.DEPARTMENTS.items()],
            "wards": [{"id": w[0], "name": w[1], "lat": w[2], "lng": w[3]} for w in engine.WARDS],
            "city": engine.CITY, "ai_model": engine._model is not None}  # don't block page load on model warm-up


@app.post("/api/reports/check")
def check(body: CheckIn, con=Depends(get_con)):
    check_category(body.category)
    ward, routing, dups = analyse(con, body.text, body.category, body.lat, body.lng, now())
    return {"ward": ward, "routing": routing, "duplicates": dups}


@app.post("/api/reports")
def submit(body: ReportIn, con=Depends(get_con)):
    check_category(body.category)
    t = now()
    rid = next_id(con, "reports", "CV")
    w = engine.ward_for(body.lat, body.lng)
    issue = None
    if body.follow_issue_id:
        issue = get_issue(con, body.follow_issue_id)
        if issue["status"] == "Closed":
            raise HTTPException(400, "That issue is already closed — please submit a new report")
    photo = None
    if body.photo_base64:
        data = base64.b64decode(body.photo_base64.split(",")[-1], validate=False)
        if len(data) > 5_000_000:
            raise HTTPException(413, "Photo must be under 5 MB")
        if not (data.startswith(b"\xff\xd8\xff") or data.startswith(b"\x89PNG")):
            raise HTTPException(400, "Photo must be a JPEG or PNG image")
        photo = f"{rid}-{secrets.token_hex(8)}.jpg"  # unguessable URL: photos may show homes/people
        with open(os.path.join(UPLOADS, photo), "wb") as f:
            f.write(data)
    code = new_tracking_code()
    con.execute("INSERT INTO reports (id, text, category, lat, lng, ward_id, landmark, photo, contact, created_at, issue_id, token) "
                "VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
                (rid, body.text.strip(), body.category, body.lat, body.lng, w[0], body.landmark, photo, body.contact,
                 iso(t), issue["id"] if issue else None, code))
    add_event(con, report_id=rid, kind="report_submitted", to_status="Triage", actor=f"Citizen ({rid})",
              role="resident", public_note="Complaint received", at=t)
    con.execute("INSERT INTO notifications (report_id, message, at) VALUES (?,?,?)",
                (rid, f"Received. Your tracking ID is {rid}-{code}.", iso(t)))
    if issue:
        _link(con, rid, issue, "Citizen (self-linked)", "resident", "Citizen chose to follow an existing issue", t)
        steps = (f"You are now following issue {issue['id']} ({report_count(con, issue['id'])} citizens reported it). "
                 "You will get every update on it.")
    else:
        # Confidence tiers: clear-cut reports go straight to the owning department; anything uncertain
        # (medium/low routing, or a probable duplicate to decide on) waits for a triage officer.
        _, routing, dups = analyse(con, body.text, body.category, body.lat, body.lng, t)
        top = routing[0]
        if top["tier"] == "high" and top["dept_id"] != "triage" and not any(d["probable"] for d in dups):
            iid = make_issue(con, get_report(con, rid), top["dept_id"], "Routing rules (auto)", "system",
                             "Auto-assigned (high confidence): " + "; ".join(top["reasons"][:2]), top["category"])
            issue = get_issue(con, iid)
            steps = (f"Sent straight to {top['dept_name']} — the rules were confident about who owns this. "
                     f"Target: {issue['sla_reason']}. Track it any time with your ID.")
        else:
            steps = "A triage officer will confirm the right department, usually within a few hours. Track it any time with your ID."
    return {"id": f"{rid}-{code}", "status": issue["status"] if issue else "Triage", "ward": {"id": w[0], "name": w[1]},
            "next_steps": steps, "issue_id": issue["id"] if issue else None}


def _link(con, rid, issue, actor, role, reason, t=None):
    t = t or now()
    con.execute("INSERT INTO links (report_id, issue_id, active, linked_by, reason, created_at) VALUES (?,?,1,?,?,?)",
                (rid, issue["id"], actor, reason, iso(t)))
    con.execute("UPDATE reports SET issue_id=? WHERE id=?", (issue["id"], rid))
    con.execute("UPDATE issues SET priority=priority+1 WHERE id=?", (issue["id"],))  # more reports → higher priority
    add_event(con, issue_id=issue["id"], report_id=rid, kind="linked", from_status=issue["status"],
              to_status=issue["status"], actor=actor, role=role, reason=reason,
              public_note="Another citizen reported this same issue", at=t)
    con.execute("INSERT INTO notifications (report_id, message, at) VALUES (?,?,?)",
                (rid, f"Linked to issue {issue['id']} ({DEPT_NAMES.get(issue['dept_id'])}). Current status: {issue['status']}.", iso(t)))


@app.get("/api/reports/{rid}")
def track(rid: str, con=Depends(get_con)):
    r = get_tracked(con, rid)
    workflow.escalate_overdue(con)
    i = con.execute("SELECT * FROM issues WHERE id=?", (r["issue_id"],)).fetchone() if r["issue_id"] else None
    ev = con.execute("SELECT * FROM events WHERE report_id=? AND kind IN ('report_submitted','submitted')", (r["id"],)).fetchall()
    if i:
        ev += con.execute("SELECT * FROM events WHERE issue_id=? AND kind IN ('assigned','created','status','handover','escalation','citizen') "
                          "ORDER BY id", (i["id"],)).fetchall()
    return {"id": f"{r['id']}-{r['token']}", "text": r["text"], "category": r["category"], "ward": WARD_NAMES.get(r["ward_id"]),
            "landmark": r["landmark"], "created_at": r["created_at"], "status": i["status"] if i else "Triage",
            "issue": i and {"id": i["id"], "dept_name": DEPT_NAMES.get(i["dept_id"]), "status": i["status"],
                            "report_count": report_count(con, i["id"]), "ack_due": i["ack_due"], "resolve_due": i["resolve_due"],
                            "sla_reason": i["sla_reason"], "escalated": bool(i["escalated"]) and i["status"] in workflow.OPEN,  # only flag while still open
                            "closure_reason": i["closure_reason"], "evidence": i["evidence"]},
            "timeline": [{"at": e["created_at"], "status": e["to_status"],
                          "public_note": e["public_note"] or (e["reason"] if e["kind"] in ("escalation", "handover", "citizen") else None)}
                         for e in sorted(ev, key=lambda e: e["id"])],
            "notifications": [dict(n) for n in con.execute(
                "SELECT at, message FROM notifications WHERE report_id=? ORDER BY id DESC", (r["id"],))],
            "can_confirm": bool(i and i["status"] == "Resolved")}


@app.post("/api/reports/{rid}/confirm")
def confirm(rid: str, body: ConfirmIn, con=Depends(get_con)):
    r = get_tracked(con, rid)
    if not r["issue_id"]:
        raise HTTPException(400, "This complaint is still in triage")
    workflow.citizen_confirm(con, get_issue(con, r["issue_id"]), r["id"], body.fixed, body.note)
    return {"ok": True, "status": get_issue(con, r["issue_id"])["status"]}


@app.get("/open311/requests.json")
def open311(con=Depends(get_con)):
    rows = con.execute("SELECT r.*, i.status AS istatus, i.dept_id, i.resolve_due FROM reports r "
                       "LEFT JOIN issues i ON i.id=r.issue_id ORDER BY r.created_at DESC LIMIT 200").fetchall()
    return [{"service_request_id": r["id"], "status": "closed" if r["istatus"] == "Closed" else "open",
             "status_notes": r["istatus"] or "Triage", "service_code": r["category"],
             "service_name": engine.CATEGORIES.get(r["category"], ("Unclassified",))[0], "description": r["text"],
             "agency_responsible": DEPT_NAMES.get(r["dept_id"]), "requested_datetime": r["created_at"],
             "expected_datetime": r["resolve_due"], "address": r["landmark"], "lat": r["lat"], "long": r["lng"],
             "parent_service_request_id": r["issue_id"]} for r in rows]


# ---------- auth ----------
@app.post("/api/auth/request-otp")
def request_otp(body: MobileIn, con=Depends(get_con)):
    return auth.request_otp(con, body.mobile)


@app.post("/api/auth/verify-otp")
def verify_otp(body: OtpIn, con=Depends(get_con)):
    token, s = auth.verify_otp(con, body.mobile, body.code)
    return {"token": token, "staff": staff_out(s)}


def staff_out(s):
    return {"id": s["id"], "name": s["name"], "designation": s["designation"], "role": s["role"],
            "dept_id": s["dept_id"], "dept_name": DEPT_NAMES.get(s["dept_id"])}


@app.get("/api/me")
def me(staff=Depends(current_staff)):
    return staff_out(staff)


@app.get("/api/demo/sms-inbox")
def sms_inbox(con=Depends(get_con)):
    return [{"to": r["to_mobile"], "message": r["message"], "at": r["at"]}
            for r in con.execute("SELECT * FROM sms_outbox ORDER BY id DESC LIMIT 10")]


@app.get("/api/demo/staff")
def demo_staff(con=Depends(get_con)):
    return [{**staff_out(s), "mobile": s["mobile"], "active": bool(s["active"])}
            for s in con.execute("SELECT * FROM staff ORDER BY id")]


# ---------- staff ----------
@app.get("/api/triage")
def triage(staff=Depends(require("triage", "supervisor", "admin")), con=Depends(get_con)):
    out = []
    for r in con.execute("SELECT * FROM reports WHERE issue_id IS NULL ORDER BY created_at").fetchall():
        ward, routing, dups = analyse(con, r["text"], r["category"], r["lat"], r["lng"], parse(r["created_at"]))
        out.append({"report": {"id": r["id"], "text": r["text"], "category": r["category"], "ward": ward["name"],
                               "landmark": r["landmark"], "lat": r["lat"], "lng": r["lng"], "created_at": r["created_at"],
                               "photo_url": f"/uploads/{r['photo']}" if r["photo"] else None},
                    "routing": routing, "duplicates": dups})
    return out


def unlinked_report(con, rid):
    r = get_report(con, rid)
    if r["issue_id"]:
        raise HTTPException(400, "Report is already linked to an issue")
    return r


@app.post("/api/triage/{rid}/create-issue")
def create_issue(rid: str, body: CreateIssueIn, staff=Depends(require("triage", "supervisor", "admin")),
                 con=Depends(get_con)):
    r = unlinked_report(con, rid)
    if body.dept_id not in engine.DEPARTMENTS or body.dept_id == "triage":
        raise HTTPException(400, "Choose the department that will own and fix this issue")
    iid = make_issue(con, r, body.dept_id, staff["name"], staff["role"], body.note)
    return issue_summary(con, get_issue(con, iid))


def make_issue(con, r, dept_id, actor, role, note=None, cat=None):
    cat = r["category"] or cat or next((c for c, rule in engine.RULES.items() if rule[0] == dept_id), None)
    t, start = now(), parse(r["created_at"])  # SLA clock starts when the citizen reported
    ack_due, res_due, why = workflow.sla_for(cat, start)
    iid = next_id(con, "issues", "IS")
    con.execute("INSERT INTO issues (id, category, lat, lng, ward_id, dept_id, status, created_at, ack_due, resolve_due, "
                "rule_version, sla_reason) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
                (iid, cat, r["lat"], r["lng"], r["ward_id"], dept_id, "Assigned", r["created_at"], ack_due, res_due,
                 engine.RULE_VERSION, why))
    add_event(con, issue_id=iid, report_id=r["id"], kind="assigned", from_status="Triage", to_status="Assigned",
              actor=actor, role=role, reason=note or f"Assigned to {DEPT_NAMES[dept_id]}",
              public_note=f"Assigned to {DEPT_NAMES[dept_id]}", at=t)
    con.execute("INSERT INTO links (report_id, issue_id, active, linked_by, reason, created_at) VALUES (?,?,1,?,?,?)",
                (r["id"], iid, actor, "Original report", iso(t)))
    con.execute("UPDATE reports SET issue_id=? WHERE id=?", (iid, r["id"]))
    workflow.notify(con, iid, f"Assigned to {DEPT_NAMES[dept_id]}. Target: {why}.", t)
    return iid


@app.post("/api/triage/{rid}/link")
def link(rid: str, body: LinkIn, staff=Depends(require("triage", "supervisor", "admin")), con=Depends(get_con)):
    unlinked_report(con, rid)
    issue = get_issue(con, body.issue_id)
    if issue["status"] == "Closed":
        raise HTTPException(400, "Cannot link to a closed issue")
    _link(con, rid, issue, staff["name"], staff["role"], body.reason or "Confirmed duplicate by triage officer")
    return issue_summary(con, get_issue(con, issue["id"]))


@app.post("/api/links/{link_id}/unlink")
def unlink(link_id: int, body: UnlinkIn, staff=Depends(require("triage", "supervisor", "admin")), con=Depends(get_con)):
    lk = con.execute("SELECT * FROM links WHERE id=? AND active=1", (link_id,)).fetchone()
    if not lk:
        raise HTTPException(404, "Link not found")
    if report_count(con, lk["issue_id"]) <= 1:
        raise HTTPException(400, "Cannot unlink the only report of an issue")
    con.execute("UPDATE links SET active=0 WHERE id=?", (link_id,))
    con.execute("UPDATE reports SET issue_id=NULL WHERE id=?", (lk["report_id"],))
    con.execute("UPDATE issues SET priority=MAX(1, priority-1) WHERE id=?", (lk["issue_id"],))
    add_event(con, issue_id=lk["issue_id"], report_id=lk["report_id"], kind="unlinked", actor=staff["name"],
              role=staff["role"], reason=body.reason)
    return {"ok": True}


@app.get("/api/issues")
def issues(status: str | None = None, dept_id: str | None = None, overdue: int = 0,
           staff=Depends(current_staff), con=Depends(get_con)):
    workflow.escalate_overdue(con)
    if staff["role"] == "officer":
        dept_id = staff["dept_id"]
    q, args = "SELECT * FROM issues WHERE 1=1", []
    if status:
        q, args = q + " AND status=?", args + [status]
    if dept_id:
        q, args = q + " AND dept_id=?", args + [dept_id]
    t = now()
    out = [issue_summary(con, i, t) for i in con.execute(q + " ORDER BY priority DESC, created_at", args).fetchall()]
    return [i for i in out if i["overdue"]] if overdue else out


@app.get("/api/issues/{iid}")
def issue_detail(iid: str, staff=Depends(current_staff), con=Depends(get_con)):
    i = get_issue(con, iid)
    if staff["role"] == "officer" and staff["dept_id"] != i["dept_id"]:
        raise HTTPException(403, "This issue belongs to another department")
    reps = con.execute("SELECT r.id, r.text, r.created_at, l.id AS link_id, l.linked_by, l.reason AS link_reason "
                       "FROM links l JOIN reports r ON r.id=l.report_id WHERE l.issue_id=? AND l.active=1 ORDER BY r.created_at",
                       (iid,)).fetchall()
    evs = con.execute("SELECT * FROM events WHERE issue_id=? ORDER BY id", (iid,)).fetchall()
    return {**issue_summary(con, i), "sla_reason": i["sla_reason"], "rule_version": i["rule_version"],
            "closure_reason": i["closure_reason"], "evidence": i["evidence"],
            "verified": None if i["verified"] is None else bool(i["verified"]),
            "reports": [dict(r) for r in reps], "events": [dict(e) for e in evs],
            "allowed_actions": workflow.allowed_actions(i, staff)}


@app.post("/api/issues/{iid}/transition")
def do_transition(iid: str, body: TransitionIn, staff=Depends(current_staff), con=Depends(get_con)):
    workflow.transition(con, get_issue(con, iid), staff, body.to, body.reason, body.public_note,
                        body.closure_reason, body.evidence, body.new_dept_id)
    return issue_summary(con, get_issue(con, iid))


@app.get("/api/audit/verify")
def audit_verify(staff=Depends(current_staff), con=Depends(get_con)):
    return db.verify_chain(con)


@app.get("/api/dashboard")
def dashboard(staff=Depends(current_staff), con=Depends(get_con)):
    workflow.escalate_overdue(con)
    t = now()
    iss = con.execute("SELECT * FROM issues").fetchall()
    open_ = [i for i in iss if i["status"] in workflow.OPEN]
    overdue = [i for i in open_ if is_overdue(i, t)]
    hours = lambda a, b: (parse(b) - parse(a)).total_seconds() / 3600
    ack = [hours(i["created_at"], i["acknowledged_at"]) for i in iss if i["acknowledged_at"]]
    res = [hours(i["created_at"], i["resolved_at"]) for i in iss if i["resolved_at"]]
    marked = [i for i in iss if i["resolved_at"] or i["status"] in ("Resolved", "Closed")]
    n = len(iss) or 1
    days = [(t - timedelta(days=d)).date() for d in range(9, -1, -1)]
    reps = con.execute("SELECT created_at FROM reports").fetchall()
    return {
        "counts": {"unassigned": con.execute("SELECT COUNT(*) FROM reports WHERE issue_id IS NULL").fetchone()[0],
                   "awaiting_ack": sum(i["status"] in ("Assigned", "Reopened") for i in iss),
                   "near_sla": sum(1 for i in open_ if not is_overdue(i, t) and parse(i["resolve_due"]) - t < timedelta(hours=6)),
                   "overdue": len(overdue), "open": len(open_), "closed": sum(i["status"] == "Closed" for i in iss)},
        "overdue_by_dept": [{"dept": DEPT_NAMES[d], "count": sum(i["dept_id"] == d for i in overdue)}
                            for d in engine.DEPARTMENTS if d != "triage"],
        "by_category": [{"category": engine.CATEGORIES[c][0], "open": sum(i["category"] == c for i in open_),
                         "closed": sum(i["category"] == c and i["status"] == "Closed" for i in iss)} for c in engine.CATEGORIES],
        "ack_hours": {"median": pct(ack, 0.5), "p90": pct(ack, 0.9)},
        "resolve_hours": {"median": pct(res, 0.5), "p90": pct(res, 0.9)},
        "overdue_rate": round(len(overdue) / (len(open_) or 1), 3),
        "closure_rate": round(len(marked) / n, 3),
        "verified_rate": round(sum(i["verified"] == 1 for i in iss) / n, 3),
        "bounce_total": sum(i["bounce_count"] for i in iss),
        "clusters": sorted(({"issue_id": i["id"], "report_count": report_count(con, i["id"])} for i in open_),
                           key=lambda c: -c["report_count"])[:10],
        "trend": [{"date": d.isoformat(), "submitted": sum(parse(r["created_at"]).date() == d for r in reps),
                   "resolved": sum(bool(i["resolved_at"]) and parse(i["resolved_at"]).date() == d for i in iss)} for d in days],
    }


@app.get("/api/hotspots")
def hotspots(staff=Depends(current_staff), con=Depends(get_con)):
    t = now()
    iss = con.execute("SELECT * FROM issues").fetchall()
    pts = [{"issue_id": i["id"], "lat": i["lat"], "lng": i["lng"], "category": i["category"],
            "report_count": report_count(con, i["id"]), "status": i["status"], "overdue": is_overdue(i, t)}
           for i in iss if i["status"] != "Closed"]
    table = {}
    for i in iss:
        k = (WARD_NAMES.get(i["ward_id"]), i["category"])
        row = table.setdefault(k, {"ward": k[0], "category": k[1], "reports": 0, "issues": 0, "overdue": 0})
        row["issues"] += 1
        row["reports"] += report_count(con, i["id"])
        row["overdue"] += is_overdue(i, t)
    return {"points": pts, "table": sorted(table.values(), key=lambda r: -r["reports"])}


@app.get("/api/evaluation")
def evaluation(staff=Depends(current_staff), con=Depends(get_con)):
    try:
        import metrics
    except ImportError:
        raise HTTPException(503, "Evaluation module not ready")
    return metrics.evaluate(con)


# ---------- static: uploads + built frontend (single-command demo) ----------
app.mount("/uploads", StaticFiles(directory=UPLOADS), name="uploads")
if os.path.isdir(DIST):
    app.mount("/assets", StaticFiles(directory=os.path.join(DIST, "assets")), name="assets")

    @app.get("/{path:path}")
    def spa(path: str, request: Request):
        root = os.path.realpath(DIST)
        f = os.path.realpath(os.path.join(root, path))
        if not f.startswith(root + os.sep) or not os.path.isfile(f):  # never serve files outside dist/
            f = os.path.join(root, "index.html")
        return FileResponse(f)
