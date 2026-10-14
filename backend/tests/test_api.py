"""HTTP-level tests: real OTP logins per role, triage, workflow, auth hardening, privacy, audit, escalation, duplicates."""
import base64
import json
import os
import re
import sys
from datetime import timedelta

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
import auth  # noqa: E402
import db  # noqa: E402
import engine  # noqa: E402
import seed  # noqa: E402

TRIAGE, ROADS, WATER, SUP, INACTIVE = "9000000001", "9000000002", "9000000006", "9000000007", "9000000009"
VAGUE = "please help, problem near my house"  # low-confidence routing → stays in triage
CONTACT = "+919876543210"


@pytest.fixture
def c(tmp_path, monkeypatch):
    monkeypatch.setattr(db, "DB_PATH", str(tmp_path / "api.db"))
    from fastapi.testclient import TestClient
    import app as appmod
    seed.reset_and_seed().close()
    return TestClient(appmod.app)


def otp_for(c, mobile):
    msg = next(m["message"] for m in c.get("/api/demo/sms-inbox").json() if m["to"].endswith(mobile))
    return re.search(r"\b(\d{6})\b", msg).group(1)


def login(c, mobile):
    assert c.post("/api/auth/request-otp", json={"mobile": mobile}).status_code == 200
    r = c.post("/api/auth/verify-otp", json={"mobile": mobile, "code": otp_for(c, mobile)})
    assert r.status_code == 200, r.text
    return {"Authorization": "Bearer " + r.json()["token"]}


def submit(c, text=VAGUE, lat=11.0255, lng=76.9030, **kw):
    r = c.post("/api/reports", json={"text": text, "lat": lat, "lng": lng, **kw})
    assert r.status_code == 200, r.text
    return r.json()


def rid(tracking):
    return tracking.rsplit("-", 1)[0]


def con():
    return db.connect()


def new_issue(c, h, dept="roads", n_reports=1):
    """Vague reports → triage creates an issue from the first and links the rest. Returns (issue_id, trackings)."""
    subs = [submit(c, lat=11.0255 + i * 1e-5) for i in range(n_reports)]
    assert all(s["status"] == "Triage" for s in subs)
    iss = c.post(f"/api/triage/{rid(subs[0]['id'])}/create-issue", json={"dept_id": dept}, headers=h)
    assert iss.status_code == 200, iss.text
    iid = iss.json()["id"]
    for s in subs[1:]:
        assert c.post(f"/api/triage/{rid(s['id'])}/link", json={"issue_id": iid}, headers=h).status_code == 200
    return iid, [s["id"] for s in subs]


def move(c, iid, h, **body):
    return c.post(f"/api/issues/{iid}/transition", json=body, headers=h)


# ---------- triage ----------
def test_triage_create_link_unlink(c):
    h = login(c, TRIAGE)
    iid, (t1, t2) = new_issue(c, h, n_reports=2)
    d = c.get(f"/api/issues/{iid}", headers=h).json()
    assert d["report_count"] == 2 and d["dept_id"] == "roads" and d["status"] == "Assigned"
    links = {r["id"]: r["link_id"] for r in d["reports"]}
    assert c.post(f"/api/triage/{rid(t2)}/link", json={"issue_id": iid}, headers=h).status_code == 400  # already linked
    assert c.post(f"/api/links/{links[rid(t2)]}/unlink", json={"reason": "different spot"}, headers=h).status_code == 200
    assert c.get(f"/api/issues/{iid}", headers=h).json()["report_count"] == 1
    assert rid(t2) in [x["report"]["id"] for x in c.get("/api/triage", headers=h).json()]  # back in the queue
    r = c.post(f"/api/links/{links[rid(t1)]}/unlink", json={"reason": "try orphaning"}, headers=h)
    assert r.status_code == 400 and "only report" in r.json()["detail"]
    assert c.post(f"/api/links/{links[rid(t2)]}/unlink", json={"reason": "again"}, headers=h).status_code == 404


def test_triage_desk_cannot_own_an_issue(c):
    h = login(c, TRIAGE)
    s = submit(c)
    for dept in ("triage", "nonexistent"):
        assert c.post(f"/api/triage/{rid(s['id'])}/create-issue", json={"dept_id": dept}, headers=h).status_code == 400
    iid, _ = new_issue(c, h)
    o = login(c, ROADS)
    assert move(c, iid, o, to="Rejected", reason="not ours", new_dept_id="triage").status_code == 400


def test_triage_endpoints_refuse_officers_and_anonymous(c):
    s = submit(c)
    assert c.post(f"/api/triage/{rid(s['id'])}/create-issue", json={"dept_id": "roads"}).status_code == 401
    o = login(c, ROADS)
    assert c.get("/api/triage", headers=o).status_code == 403
    assert c.post(f"/api/triage/{rid(s['id'])}/create-issue", json={"dept_id": "roads"}, headers=o).status_code == 403


# ---------- workflow ----------
def test_officer_of_other_department_gets_403(c):
    iid, _ = new_issue(c, login(c, TRIAGE))
    w = login(c, WATER)
    assert c.get(f"/api/issues/{iid}", headers=w).status_code == 403
    assert move(c, iid, w, to="Acknowledged").status_code == 403
    assert iid not in [i["id"] for i in c.get("/api/issues?dept_id=roads", headers=w).json()]  # filter is forced


def test_resolve_requires_closure_reason_and_evidence(c):
    iid, _ = new_issue(c, login(c, TRIAGE))
    o = login(c, ROADS)
    assert move(c, iid, o, to="Resolved", closure_reason="Repaired", evidence="x").status_code == 400  # skip ack
    assert move(c, iid, o, to="Acknowledged").status_code == 200
    assert move(c, iid, o, to="Resolved", evidence="patched").status_code == 400
    assert move(c, iid, o, to="Resolved", closure_reason="Repaired").status_code == 400
    assert move(c, iid, o, to="Resolved", closure_reason="Magic", evidence="patched").status_code == 400
    r = move(c, iid, o, to="Resolved", closure_reason="Repaired", evidence="patched, photo on file")
    assert r.status_code == 200 and r.json()["status"] == "Resolved"


def test_reject_requires_a_different_new_department(c):
    iid, _ = new_issue(c, login(c, TRIAGE))
    o = login(c, ROADS)
    assert move(c, iid, o, to="Rejected", reason="not ours").status_code == 400
    assert move(c, iid, o, to="Rejected", reason="not ours", new_dept_id="roads").status_code == 400
    assert move(c, iid, o, to="Rejected", new_dept_id="water").status_code == 400  # reason required too
    r = move(c, iid, o, to="Rejected", reason="water main leak", new_dept_id="water")
    assert r.status_code == 200 and r.json()["dept_id"] == "water" and r.json()["status"] == "Assigned"
    assert r.json()["bounce_count"] == 1
    assert c.get(f"/api/issues/{iid}", headers=o).status_code == 403  # roads lost it
    assert c.get(f"/api/issues/{iid}", headers=login(c, WATER)).status_code == 200


def test_dispatch_trail_shows_sent_and_received_per_hop(c):
    iid, tr = new_issue(c, login(c, TRIAGE))
    o, w = login(c, ROADS), login(c, WATER)
    d = c.get(f"/api/issues/{iid}", headers=o).json()["dispatch"]
    assert len(d["hops"]) == 1 and d["hops"][0]["from"] == "Triage desk" and d["hops"][0]["received_at"] is None
    assert iid in [r["id"] for r in c.get("/api/dispatch", headers=o).json()["incoming"]]
    move(c, iid, o, to="Rejected", reason="water main leak", new_dept_id="water")
    assert iid in [r["id"] for r in c.get("/api/dispatch", headers=o).json()["sent_waiting"]]  # roads sent it, water hasn't received
    move(c, iid, w, to="Acknowledged")
    hops = c.get(f"/api/issues/{iid}", headers=w).json()["dispatch"]["hops"]
    assert [h["to"] for h in hops][-1] == "Water Supply Dept" and hops[-1]["received_by"] and hops[-1]["from"] == hops[0]["to"]
    pub = c.get(f"/api/reports/{tr[0]}").json()["dispatch"]["hops"]
    assert len(pub) == 2 and "received_by" not in pub[0] and pub[1]["received_at"]  # no officer names in public view


def _resolved_issue(c):
    iid, tr = new_issue(c, login(c, TRIAGE))
    o = login(c, ROADS)
    move(c, iid, o, to="Acknowledged")
    assert move(c, iid, o, to="Resolved", closure_reason="Repaired", evidence="patched").status_code == 200
    return iid, tr[0], o


def test_citizen_confirm_needs_full_tracking_id(c):
    iid, tracking, _ = _resolved_issue(c)
    assert c.get(f"/api/reports/{tracking}").json()["can_confirm"]
    assert c.post(f"/api/reports/{rid(tracking)}/confirm", json={"fixed": True}).status_code == 404
    assert c.post(f"/api/reports/{rid(tracking)}-ZZZZZZ/confirm", json={"fixed": True}).status_code == 404
    r = c.post(f"/api/reports/{tracking}/confirm", json={"fixed": True})
    assert r.status_code == 200 and r.json()["status"] == "Closed"
    assert c.post(f"/api/reports/{tracking}/confirm", json={"fixed": False}).status_code == 400  # already closed


def test_closure_needs_30_percent_of_reporters(c):
    iid, tr = new_issue(c, login(c, TRIAGE), n_reports=4)  # ceil(0.3 * 4) = 2 confirmations
    o = login(c, ROADS)
    move(c, iid, o, to="Acknowledged")
    assert move(c, iid, o, to="Resolved", closure_reason="Repaired", evidence="patched").status_code == 200
    assert c.get(f"/api/reports/{tr[0]}").json()["confirmations"] == {"have": 0, "need": 2, "mine": False}
    r = c.post(f"/api/reports/{tr[0]}/confirm", json={"fixed": True})
    assert r.status_code == 200 and r.json()["status"] == "Resolved"  # 1 of 2 — still open
    assert c.post(f"/api/reports/{tr[0]}/confirm", json={"fixed": True}).status_code == 400  # same reporter twice
    assert c.get(f"/api/reports/{tr[1]}").json()["confirmations"]["have"] == 1
    r = c.post(f"/api/reports/{tr[1]}/confirm", json={"fixed": True})
    assert r.status_code == 200 and r.json()["status"] == "Closed"


def test_one_dispute_reopens_even_mid_quorum(c):
    iid, tr = new_issue(c, login(c, TRIAGE), n_reports=4)
    o = login(c, ROADS)
    move(c, iid, o, to="Acknowledged")
    move(c, iid, o, to="Resolved", closure_reason="Repaired", evidence="patched")
    c.post(f"/api/reports/{tr[0]}/confirm", json={"fixed": True})
    r = c.post(f"/api/reports/{tr[2]}/confirm", json={"fixed": False, "note": "still broken"})
    assert r.status_code == 200 and r.json()["status"] == "Reopened"


def test_reopen_gives_fresh_ack_deadline_and_is_not_overdue(c):
    iid, tracking, o = _resolved_issue(c)
    k = con()
    k.execute("UPDATE issues SET ack_due=? WHERE id=?", (db.iso(db.now() - timedelta(hours=5)), iid))  # old window
    k.commit()
    k.close()
    r = c.post(f"/api/reports/{tracking}/confirm", json={"fixed": False, "note": "still broken"})
    assert r.status_code == 200 and r.json()["status"] == "Reopened"
    d = c.get(f"/api/issues/{iid}", headers=o).json()
    assert db.parse(d["ack_due"]) > db.now() and not d["overdue"] and not d["escalated"]
    assert "Acknowledged" in d["allowed_actions"] and d["verified"] is False


def test_reopen_of_old_issue_is_not_instantly_overdue(c):
    iid, tracking, o = _resolved_issue(c)
    k = con()
    past = db.iso(db.now() - timedelta(hours=1))
    k.execute("UPDATE issues SET ack_due=?, resolve_due=? WHERE id=?", (past, past, iid))
    k.commit()
    k.close()
    c.post(f"/api/reports/{tracking}/confirm", json={"fixed": False})
    d = c.get(f"/api/issues/{iid}", headers=o).json()
    assert not d["overdue"] and not d["escalated"]


# ---------- auth ----------
def test_unknown_and_inactive_numbers_refused(c):
    assert c.post("/api/auth/request-otp", json={"mobile": "9999999999"}).status_code == 403
    assert c.post("/api/auth/request-otp", json={"mobile": INACTIVE}).status_code == 403
    assert c.post("/api/auth/verify-otp", json={"mobile": INACTIVE, "code": "123456"}).status_code == 403
    assert not any(m["to"].endswith(INACTIVE) for m in c.get("/api/demo/sms-inbox").json())
    k = con()
    assert k.execute("SELECT COUNT(*) FROM events WHERE kind='login_refused'").fetchone()[0] == 3
    k.close()


def test_resend_cooldown_429(c):
    assert c.post("/api/auth/request-otp", json={"mobile": ROADS}).status_code == 200
    assert c.post("/api/auth/request-otp", json={"mobile": ROADS}).status_code == 429


def _wrong(c, mobile):
    code = otp_for(c, mobile)
    return c.post("/api/auth/verify-otp", json={"mobile": mobile, "code": "000000" if code != "000000" else "111111"})


def test_three_wrong_codes_lock_the_account(c):
    c.post("/api/auth/request-otp", json={"mobile": ROADS})
    good = otp_for(c, ROADS)
    assert [_wrong(c, ROADS).status_code for _ in range(3)] == [401, 401, 423]
    assert c.post("/api/auth/verify-otp", json={"mobile": ROADS, "code": good}).status_code == 423  # even the right code
    assert c.post("/api/auth/request-otp", json={"mobile": ROADS}).status_code == 423
    k = con()
    assert k.execute("SELECT COUNT(*) FROM events WHERE kind='login_locked'").fetchone()[0] == 1
    k.close()


def test_fail_counter_survives_new_otp_requests(c, monkeypatch):
    monkeypatch.setattr(auth, "RESEND_COOLDOWN", 0)
    codes = []
    for n in (2, 2, 1):  # never 3 on one code, but 5 in total
        assert c.post("/api/auth/request-otp", json={"mobile": ROADS}).status_code == 200
        codes += [_wrong(c, ROADS).status_code for _ in range(n)]
    assert codes == [401, 401, 401, 401, 423]


def test_expired_and_tampered_tokens_rejected(c, monkeypatch):
    h = login(c, ROADS)
    assert c.get("/api/me", headers=h).status_code == 200
    token = h["Authorization"].split()[1]
    body, sig = token.split(".")
    data = json.loads(base64.urlsafe_b64decode(body))
    for forged in ({**data, "sid": 7}, {**data, "exp": db.iso(db.now() + timedelta(days=365))}):
        fb = base64.urlsafe_b64encode(json.dumps(forged).encode()).decode()
        assert c.get("/api/me", headers={"Authorization": f"Bearer {fb}.{sig}"}).status_code == 401
    assert c.get("/api/me", headers={"Authorization": "Bearer garbage"}).status_code == 401
    assert c.get("/api/me").status_code == 401
    monkeypatch.setattr(auth, "now", lambda: db.now() + timedelta(hours=auth.SESSION_H, minutes=1))
    assert c.get("/api/me", headers=h).status_code == 401


def test_deactivated_officer_token_stops_working(c):
    h = login(c, ROADS)
    k = con()
    k.execute("UPDATE staff SET active=0 WHERE mobile='+919000000002'")
    k.commit()
    k.close()
    assert c.get("/api/me", headers=h).status_code == 401


# ---------- privacy ----------
def test_public_endpoints_never_leak_phone_numbers(c):
    s = submit(c, "Streetlight not working near the park", 11.02, 76.96, contact=CONTACT, landmark="Park gate")
    iid, tr = new_issue(c, login(c, TRIAGE))
    move(c, iid, login(c, ROADS), to="Acknowledged")
    k = con()
    mobiles = [r[0] for r in k.execute("SELECT mobile FROM staff")]
    k.close()
    for url in (f"/api/reports/{s['id']}", f"/api/reports/{tr[0]}", "/open311/requests.json", "/api/public/board"):
        txt = c.get(url).text
        assert "9876543210" not in txt and not any(m[3:] in txt for m in mobiles), url
        assert "+91" not in txt, url


# ---------- audit ----------
def test_api_actions_append_events_and_tamper_is_located(c):
    k = con()
    count = lambda: k.execute("SELECT COUNT(*) FROM events").fetchone()[0]  # noqa: E731
    n0 = count()
    h = login(c, TRIAGE)
    assert count() == n0 + 1  # login
    s = submit(c)
    assert count() == n0 + 2  # report_submitted
    iid, _ = new_issue(c, h)  # submit + assigned
    o = login(c, ROADS)
    move(c, iid, o, to="Acknowledged")
    assert count() == n0 + 6
    kinds = [r[0] for r in k.execute("SELECT kind FROM events WHERE id>? ORDER BY id", (n0,))]
    assert kinds == ["login", "report_submitted", "report_submitted", "assigned", "login", "status"]
    actor = k.execute("SELECT actor, role FROM events ORDER BY id DESC LIMIT 1").fetchone()
    assert tuple(actor) == ("S. Muthukumar", "officer")  # the logged-in officer, not a generic user
    v = c.get("/api/audit/verify", headers=h).json()
    assert v["ok"] and v["checked"] == count()
    target = n0 + 4
    k.execute("DROP TRIGGER events_no_update")
    k.execute("UPDATE events SET reason='nothing happened' WHERE id=?", (target,))
    k.commit()
    k.close()
    assert c.get("/api/audit/verify", headers=h).json() == {"ok": False, "checked": target, "broken_at": target}
    assert s  # report submit above is part of the counted actions


# ---------- escalation ----------
def test_overdue_issue_escalates_once_and_notifies_all_reporters(c):
    h = login(c, TRIAGE)
    iid, trackings = new_issue(c, h, n_reports=2)
    k = con()
    k.execute("UPDATE issues SET ack_due=? WHERE id=?", (db.iso(db.now() - timedelta(minutes=5)), iid))
    k.commit()
    for _ in range(2):
        d = next(i for i in c.get("/api/issues", headers=h).json() if i["id"] == iid)
        assert d["overdue"] and d["escalated"]
    c.get("/api/public/board")
    assert k.execute("SELECT COUNT(*) FROM events WHERE issue_id=? AND kind='escalation'", (iid,)).fetchone()[0] == 1
    k.close()
    for t in trackings:
        msgs = [n["message"] for n in c.get(f"/api/reports/{t}").json()["notifications"]]
        assert sum("escalated" in m for m in msgs) == 1, t


# ---------- duplicates ----------
AT = db.now()
SPOT = (11.0183, 76.9725)


def _issue(cat, text, lat, lng):
    return {"id": "IS-X", "category": cat, "status": "Assigned", "report_count": 1,
            "reports": [{"text": text, "lat": lat, "lng": lng, "created_at": AT - timedelta(hours=1)}]}


def test_cross_language_pair_same_spot_is_probable():
    assert engine.ai_available(), "multilingual model is required for this test"
    en = _issue("garbage", "Garbage bin overflowing near the bus stand, very bad smell", *SPOT)
    d = engine.dup_candidates("பேருந்து நிலையம் அருகே குப்பைத் தொட்டி நிரம்பி வழிகிறது, நாற்றம் தாங்க முடியவில்லை",
                              "garbage", *SPOT, AT, [en])
    assert d and d[0]["probable"] and "Cross-language" in d[0]["reasons"][0]


def test_same_text_500m_away_is_not_a_candidate():
    text = "Garbage bin overflowing near the bus stand, very bad smell"
    far = _issue("garbage", text, SPOT[0] + 500 / 111_195, SPOT[1])  # ~500 m north
    assert 480 < engine.haversine_m(*SPOT, far["reports"][0]["lat"], far["reports"][0]["lng"]) < 520
    assert engine.dup_candidates(text, "garbage", *SPOT, AT, [far]) == []


def test_different_category_is_not_a_candidate():
    text = "Garbage bin overflowing near the bus stand, very bad smell"
    assert engine.dup_candidates(text, "garbage", *SPOT, AT, [_issue("water", text, *SPOT)]) == []
