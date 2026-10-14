import os
import sys
from datetime import timedelta

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
import auth  # noqa: E402
import db  # noqa: E402
import engine  # noqa: E402
import workflow  # noqa: E402


@pytest.fixture
def con(tmp_path, monkeypatch):
    monkeypatch.setattr(db, "DB_PATH", str(tmp_path / "t.db"))
    c = db.connect()
    db.init(c)
    c.execute("INSERT INTO staff (name, designation, mobile, role, dept_id) VALUES "
              "('Officer R','AE','+919000000001','officer','roads'),"
              "('Officer W','AE','+919000000002','officer','water'),"
              "('Sup','SE','+919000000003','supervisor',NULL)")
    t = db.now() - timedelta(hours=100)
    a, r, why = workflow.sla_for("roads", t)
    c.execute("INSERT INTO issues (id, category, lat, lng, ward_id, dept_id, status, created_at, ack_due, resolve_due, sla_reason) "
              "VALUES ('IS-0001','roads',11,76.9,1,'roads','Assigned',?,?,?,?)", (db.iso(t), a, r, why))
    return c


def staff(con, mobile):
    return con.execute("SELECT * FROM staff WHERE mobile=?", (mobile,)).fetchone()


def issue(con):
    return con.execute("SELECT * FROM issues WHERE id='IS-0001'").fetchone()


def test_routing_explains_and_tiers():
    top = engine.route("Big pothole on the road near bus stand", "roads", "Gandhipuram")[0]
    assert top["dept_id"] == "roads" and top["tier"] == "high"
    assert any("pothole" in r for r in top["reasons"])
    ta = engine.route("சாலையில் பெரிய பள்ளம்", None)[0]
    assert ta["dept_id"] == "roads"
    vague = engine.route("please help, problem near my house", None)[0]
    assert vague["dept_id"] == "triage" and vague["tier"] == "low"


def test_pair_score_prefers_close_similar():
    assert engine.pair_score(0.9, 20, 1, "ai") > engine.DUP_THRESHOLD > engine.pair_score(0.81, 250, 100, "ai")


def test_state_machine_roles_and_requirements(con):
    with pytest.raises(workflow.WorkflowError) as e:  # other department's officer
        workflow.transition(con, issue(con), staff(con, "+919000000002"), "Acknowledged")
    assert e.value.status == 403
    with pytest.raises(workflow.WorkflowError):  # skipping states
        workflow.transition(con, issue(con), staff(con, "+919000000001"), "Resolved")
    workflow.transition(con, issue(con), staff(con, "+919000000001"), "Acknowledged")
    with pytest.raises(workflow.WorkflowError):  # resolve needs reason + evidence
        workflow.transition(con, issue(con), staff(con, "+919000000001"), "Resolved")
    workflow.transition(con, issue(con), staff(con, "+919000000001"), "Resolved",
                        closure_reason="Repaired", evidence="Patched with asphalt, photo on file")
    workflow.citizen_confirm(con, issue(con), "CV-0001", fixed=False, note="still broken")
    assert issue(con)["status"] == "Reopened" and issue(con)["verified"] == 0


def test_reject_requires_new_owner(con):
    with pytest.raises(workflow.WorkflowError):
        workflow.transition(con, issue(con), staff(con, "+919000000001"), "Rejected", reason="not ours")
    workflow.transition(con, issue(con), staff(con, "+919000000001"), "Rejected", reason="water main leak",
                        new_dept_id="water")
    i = issue(con)
    assert i["dept_id"] == "water" and i["status"] == "Assigned" and i["bounce_count"] == 1


def test_escalation_once(con):
    assert workflow.escalate_overdue(con) == 1
    assert workflow.escalate_overdue(con) == 0
    assert issue(con)["escalated"] == 1


def test_audit_chain_append_only_and_tamper_evident(con):
    workflow.transition(con, issue(con), staff(con, "+919000000001"), "Acknowledged")
    assert db.verify_chain(con)["ok"]
    with pytest.raises(Exception):
        con.execute("UPDATE events SET reason='edited'")
    con.execute("DROP TRIGGER events_no_update")  # an insider bypassing the app...
    con.execute("UPDATE events SET reason='edited' WHERE id=1")
    assert db.verify_chain(con) == {"ok": False, "checked": 1, "broken_at": 1}  # ...is still caught


def test_otp_login_flow(con):
    with pytest.raises(auth.AuthError) as e:
        auth.request_otp(con, "+919999999999")
    assert e.value.status == 403
    auth.request_otp(con, "9000000001")
    code = con.execute("SELECT message FROM sms_outbox ORDER BY id DESC").fetchone()[0].split(": ")[1][:6]
    with pytest.raises(auth.AuthError):
        auth.verify_otp(con, "9000000001", "000000" if code != "000000" else "111111")
    token, s = auth.verify_otp(con, "9000000001", code)
    assert auth.staff_from_token(con, token)["id"] == s["id"]
    with pytest.raises(auth.AuthError):  # OTP is single-use
        auth.verify_otp(con, "9000000001", code)
    with pytest.raises(auth.AuthError):
        auth.staff_from_token(con, token[:-1] + ("1" if token[-1] == "0" else "0"))
