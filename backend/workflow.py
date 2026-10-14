"""Issue state machine: who may move an issue from which status to which, and what each move requires."""
from datetime import timedelta

from db import add_event, iso, now, parse
from engine import DEPARTMENTS, RULES, RULE_VERSION

CLOSURE_REASONS = ["Repaired", "No action needed", "Referred to other authority", "Could not resolve"]
OPEN = ("Assigned", "Acknowledged", "In progress", "Reopened")

# (from, to) -> roles allowed. "officer" means an officer of the issue's own department.
TRANSITIONS = {
    ("Assigned", "Acknowledged"): {"officer"},
    ("Reopened", "Acknowledged"): {"officer"},
    ("Acknowledged", "In progress"): {"officer"},
    ("In progress", "In progress"): {"officer"},  # progress update
    ("Acknowledged", "Resolved"): {"officer"},
    ("In progress", "Resolved"): {"officer"},
    ("Assigned", "Rejected"): {"officer"},  # must name the next owner
    ("Resolved", "Closed"): {"supervisor", "admin"},
    **{(s, "Reassigned"): {"supervisor", "admin"} for s in OPEN},
}
ACTION_LABELS = {"Acknowledged": "Acknowledge", "In progress": "Start / post update", "Resolved": "Resolve",
                 "Rejected": "Reject & hand over", "Closed": "Close", "Reassigned": "Reassign"}


class WorkflowError(Exception):
    def __init__(self, status, msg):
        super().__init__(msg)
        self.status = status


def allowed_actions(issue, staff) -> list[str]:
    role = staff["role"]
    if role == "officer" and staff["dept_id"] != issue["dept_id"]:
        return []
    return [to for (frm, to), roles in TRANSITIONS.items() if frm == issue["status"] and role in roles]


def sla_for(category, start):
    _, _, ack_h, res_h = RULES[category] if category in RULES else ("triage", "", 24, 72)
    reason = f"{category or 'unclassified'}: acknowledge within {ack_h} h, resolve within {res_h} h (rule v{RULE_VERSION}, demo targets)"
    return iso(start + timedelta(hours=ack_h)), iso(start + timedelta(hours=res_h)), reason


def notify(con, issue_id, message, at=None):
    for r in con.execute("SELECT report_id FROM links WHERE issue_id=? AND active=1", (issue_id,)):
        con.execute("INSERT INTO notifications (report_id, message, at) VALUES (?,?,?)",
                    (r["report_id"], message, iso(at or now())))


def transition(con, issue, staff, to, reason=None, public_note=None, closure_reason=None, evidence=None,
               new_dept_id=None, at=None):
    at = at or now()
    frm = issue["status"]
    roles = TRANSITIONS.get((frm, to))
    if roles is None:
        raise WorkflowError(400, f"Cannot move from '{frm}' to '{to}'")
    if staff["role"] not in roles or (staff["role"] == "officer" and staff["dept_id"] != issue["dept_id"]):
        raise WorkflowError(403, f"Your role cannot move this issue from '{frm}' to '{to}'")
    actor, role = staff["name"], staff["role"]
    upd = {}
    if to in ("Rejected", "Reassigned"):
        if not reason or not new_dept_id or new_dept_id not in DEPARTMENTS or new_dept_id == issue["dept_id"]:
            raise WorkflowError(400, "A reason and a different new department are required — the issue can never be left without an owner")
        add_event(con, issue_id=issue["id"], kind="handover", from_status=frm, to_status=to, actor=actor,
                  role=role, reason=f"{reason} → handed to {DEPARTMENTS[new_dept_id][0]}", at=at)
        upd = {"dept_id": new_dept_id, "status": "Assigned", "bounce_count": issue["bounce_count"] + 1,
               "acknowledged_at": None}
        to = "Assigned"
        msg = f"Your complaint was transferred to {DEPARTMENTS[new_dept_id][0]}."
    else:
        if to == "In progress" and frm == "In progress" and not public_note:
            raise WorkflowError(400, "A progress update needs a public note")
        if to == "Resolved":
            if closure_reason not in CLOSURE_REASONS or not evidence:
                raise WorkflowError(400, f"Resolving needs a closure reason ({', '.join(CLOSURE_REASONS)}) and evidence")
            upd = {"resolved_at": iso(at), "closure_reason": closure_reason, "evidence": evidence}
        if to == "Acknowledged":
            upd = {"acknowledged_at": iso(at)}
        if to == "Closed":
            upd = {"closed_at": iso(at)}
        upd["status"] = to
        msg = {"Acknowledged": "The department has acknowledged your complaint.",
               "In progress": f"Update: {public_note or 'work has started.'}",
               "Resolved": f"Marked resolved ({closure_reason}). Please confirm if it is really fixed.",
               "Closed": "Your complaint has been closed."}[to]
    add_event(con, issue_id=issue["id"], kind="status", from_status=frm, to_status=to, actor=actor, role=role,
              reason=reason or closure_reason, public_note=public_note or (evidence and f"Evidence: {evidence}"), at=at)
    if upd:
        con.execute(f"UPDATE issues SET {', '.join(k + '=?' for k in upd)} WHERE id=?", [*upd.values(), issue["id"]])
    notify(con, issue["id"], msg, at)


def citizen_confirm(con, issue, report_id, fixed: bool, note=None, at=None):
    at = at or now()
    if issue["status"] != "Resolved":
        raise WorkflowError(400, "Only a resolved issue can be confirmed or reopened")
    to = "Closed" if fixed else "Reopened"
    add_event(con, issue_id=issue["id"], report_id=report_id, kind="citizen", from_status="Resolved", to_status=to,
              actor=f"Citizen ({report_id})", role="resident",
              reason="Citizen confirmed the fix" if fixed else "Citizen says it is NOT fixed",
              public_note=note, at=at)
    if fixed:
        con.execute("UPDATE issues SET status='Closed', closed_at=?, verified=1 WHERE id=?", (iso(at), issue["id"]))
        notify(con, issue["id"], "A citizen confirmed the issue is fixed. Closed.", at)
    else:
        con.execute("UPDATE issues SET status='Reopened', verified=0, resolved_at=NULL, priority=priority+1 WHERE id=?",
                    (issue["id"],))
        notify(con, issue["id"], "Reopened: a citizen reported it is not fixed. Sent back to the department.", at)


def escalate_overdue(con, at=None):
    """Flag open issues past their deadline and log a system escalation (once per issue)."""
    at = at or now()
    n = 0
    for i in con.execute("SELECT * FROM issues WHERE escalated=0").fetchall():
        late_ack = i["status"] in ("Assigned", "Reopened") and parse(i["ack_due"]) < at
        late_res = i["status"] in OPEN and parse(i["resolve_due"]) < at
        if late_ack or late_res:
            what = "acknowledgement" if late_ack and not late_res else "resolution"
            add_event(con, issue_id=i["id"], kind="escalation", from_status=i["status"], to_status=i["status"],
                      reason=f"Overdue for {what} — escalated to supervisor", at=at)
            con.execute("UPDATE issues SET escalated=1, priority=priority+1 WHERE id=?", (i["id"],))
            notify(con, i["id"], "Your complaint is overdue and has been escalated to a supervisor.", at)
            n += 1
    return n
