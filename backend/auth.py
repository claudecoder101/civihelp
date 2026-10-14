"""Staff login: registered government mobile number + OTP. SMS is simulated (demo outbox)."""
import base64
import hashlib
import hmac
import json
import os
import secrets
from datetime import timedelta

from db import add_event, iso, key_file as db_key, now, parse
from engine import APP_NAME

SECRET = os.environ.get("CIVIC_SECRET") or db_key(".session_key")  # persisted so a restart does not log staff out
OTP_TTL, RESEND_COOLDOWN, MAX_ATTEMPTS, MAX_FAILS, LOCK_MIN, SESSION_H = 300, 30, 3, 5, 10, 8


class AuthError(Exception):
    def __init__(self, status, msg):
        super().__init__(msg)
        self.status = status


def normalize(mobile: str) -> str:
    digits = "".join(c for c in mobile or "" if c.isdigit())
    return "+91" + digits[-10:] if len(digits) >= 10 else ""


def send_sms(con, to, message):
    # shortcut: writes to a demo outbox; replace with an SMS gateway (NIC/CDAC, MSG91) for production
    con.execute("INSERT INTO sms_outbox (to_mobile, message, at) VALUES (?,?,?)", (to, message, iso(now())))


def _hash(mobile, code):
    return hmac.new(SECRET.encode(), f"{mobile}:{code}".encode(), hashlib.sha256).hexdigest()


def _staff(con, mobile):
    s = con.execute("SELECT * FROM staff WHERE mobile=? AND active=1", (mobile,)).fetchone()
    if not s:
        add_event(con, kind="login_refused", actor=mobile[:-4] + "XXXX", role="unknown",
                  reason="Number not in the official staff directory")
        raise AuthError(403, "This number is not registered in the official staff directory")
    return s


def request_otp(con, mobile):
    mobile = normalize(mobile)
    s = _staff(con, mobile)
    t = now()
    o = con.execute("SELECT * FROM otps WHERE mobile=?", (mobile,)).fetchone()
    if o and o["locked_until"] and parse(o["locked_until"]) > t:
        raise AuthError(423, "Too many failed attempts — locked for a few minutes")
    if o and o["last_sent"] and (t - parse(o["last_sent"])).total_seconds() < RESEND_COOLDOWN:
        raise AuthError(429, f"Please wait {RESEND_COOLDOWN} seconds before requesting another OTP")
    code = f"{secrets.randbelow(10**6):06d}"
    con.execute("INSERT OR REPLACE INTO otps (mobile, code_hash, expires_at, attempts, last_sent, fails, locked_until) "
                "VALUES (?,?,?,0,?,?,NULL)",
                (mobile, _hash(mobile, code), iso(t + timedelta(seconds=OTP_TTL)), iso(t), o["fails"] if o else 0))
    send_sms(con, mobile, f"{APP_NAME} login OTP for {s['name']}: {code}. Valid 5 min. Never share it.")
    return {"ok": True, "cooldown_s": RESEND_COOLDOWN}


def verify_otp(con, mobile, code):
    mobile = normalize(mobile)
    s = _staff(con, mobile)
    t = now()
    o = con.execute("SELECT * FROM otps WHERE mobile=?", (mobile,)).fetchone()
    if o and o["locked_until"] and parse(o["locked_until"]) > t:  # lock wins, even over a correct code
        raise AuthError(423, "Too many failed attempts — locked for a few minutes")
    if not o or not o["code_hash"]:
        raise AuthError(401, "Request an OTP first")
    if parse(o["expires_at"]) < t:
        raise AuthError(401, "OTP expired — request a new one")
    if not hmac.compare_digest(o["code_hash"], _hash(mobile, (code or "").strip())):
        attempts, fails = o["attempts"] + 1, (o["fails"] or 0) + 1
        con.execute("UPDATE otps SET fails=? WHERE mobile=?", (fails, mobile))  # survives new OTP requests
        if attempts >= MAX_ATTEMPTS or fails >= MAX_FAILS:
            con.execute("UPDATE otps SET fails=0 WHERE mobile=?", (mobile,))
            con.execute("UPDATE otps SET attempts=0, code_hash=NULL, locked_until=? WHERE mobile=?",
                        (iso(t + timedelta(minutes=LOCK_MIN)), mobile))
            add_event(con, kind="login_locked", actor=s["name"], role=s["role"], reason="Too many wrong OTPs — account locked")
            raise AuthError(423, f"Too many wrong OTPs — locked for {LOCK_MIN} minutes")
        con.execute("UPDATE otps SET attempts=? WHERE mobile=?", (attempts, mobile))
        add_event(con, kind="login_failed", actor=s["name"], role=s["role"], reason="Wrong OTP")
        raise AuthError(401, f"Wrong OTP — {MAX_ATTEMPTS - attempts} attempt(s) left")
    con.execute("UPDATE otps SET code_hash=NULL, attempts=0, fails=0 WHERE mobile=?", (mobile,))  # one-time use
    add_event(con, kind="login", actor=s["name"], role=s["role"], reason="Logged in with registered mobile + OTP")
    return make_token(s["id"]), s


def make_token(staff_id):
    body = base64.urlsafe_b64encode(json.dumps({"sid": staff_id, "exp": iso(now() + timedelta(hours=SESSION_H))}).encode()).decode()
    return body + "." + hmac.new(SECRET.encode(), body.encode(), hashlib.sha256).hexdigest()


def staff_from_token(con, token):
    try:
        body, sig = token.split(".")
        if not hmac.compare_digest(sig, hmac.new(SECRET.encode(), body.encode(), hashlib.sha256).hexdigest()):
            raise ValueError
        data = json.loads(base64.urlsafe_b64decode(body))
        if parse(data["exp"]) < now() or "sid" not in data:  # a citizen token is never a staff token
            raise ValueError
    except Exception:
        raise AuthError(401, "Please log in again")
    s = con.execute("SELECT * FROM staff WHERE id=? AND active=1", (data["sid"],)).fetchone()
    if not s:
        raise AuthError(401, "Account deactivated")
    return s


# ---------- citizens (simulated identity) ----------
# Demo registry standing in for Aadhaar e-KYC / DigiLocker: fictional numbers with fixed mock OTPs.
# No Aadhaar data is requested or stored. Production: replace citizen_login with a real e-KYC check.
DEMO_CITIZENS = {
    "+919894021482": {"id": "priya", "name": "Priya S.", "otp": "482193"},
    "+919943017356": {"id": "arun", "name": "Arun K.", "otp": "735614"},
}
REPORTS_PER_HOUR = 10  # per citizen — stops one account flooding the queue


def _sign(payload):
    body = base64.urlsafe_b64encode(json.dumps(payload).encode()).decode()
    return body + "." + hmac.new(SECRET.encode(), body.encode(), hashlib.sha256).hexdigest()


def citizen_login(con, mobile, code):
    m = normalize(mobile)
    if con.execute("SELECT 1 FROM staff WHERE mobile=?", (m,)).fetchone():
        raise AuthError(403, "This number belongs to a staff account. Use Staff login.")
    c = DEMO_CITIZENS.get(m)
    if not c:
        raise AuthError(403, "This demo only knows the two demo citizens.")
    if not hmac.compare_digest((code or "").strip(), c["otp"]):
        raise AuthError(401, "That code is wrong.")
    return _sign({"cid": c["id"], "exp": iso(now() + timedelta(hours=SESSION_H))}), c


def citizen_from_token(token):
    try:
        body, sig = (token or "").split(".")
        if not hmac.compare_digest(sig, hmac.new(SECRET.encode(), body.encode(), hashlib.sha256).hexdigest()):
            raise ValueError
        data = json.loads(base64.urlsafe_b64decode(body))
        if parse(data["exp"]) < now() or "cid" not in data:  # a staff token is never a citizen token
            raise ValueError
    except Exception:
        raise AuthError(401, "Please sign in as a citizen first")
    return data["cid"]
