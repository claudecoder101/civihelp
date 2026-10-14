"""Staff login: registered government mobile number + OTP. SMS is simulated (demo outbox)."""
import base64
import hashlib
import hmac
import json
import os
import secrets
from datetime import timedelta

from db import add_event, iso, now, parse

SECRET = os.environ.get("CIVIC_SECRET") or secrets.token_hex(32)  # tokens reset on restart if unset
OTP_TTL, RESEND_COOLDOWN, MAX_ATTEMPTS, LOCK_MIN, SESSION_H = 300, 30, 3, 10, 8


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
    send_sms(con, mobile, f"CivicResolve login OTP for {s['name']}: {code}. Valid 5 min. Never share it.")
    return {"ok": True, "cooldown_s": RESEND_COOLDOWN}


def verify_otp(con, mobile, code):
    mobile = normalize(mobile)
    s = _staff(con, mobile)
    t = now()
    o = con.execute("SELECT * FROM otps WHERE mobile=?", (mobile,)).fetchone()
    if not o or not o["code_hash"]:
        raise AuthError(401, "Request an OTP first")
    if o["locked_until"] and parse(o["locked_until"]) > t:
        raise AuthError(423, "Too many failed attempts — locked for a few minutes")
    if parse(o["expires_at"]) < t:
        raise AuthError(401, "OTP expired — request a new one")
    if not hmac.compare_digest(o["code_hash"], _hash(mobile, (code or "").strip())):
        attempts = o["attempts"] + 1
        if attempts >= MAX_ATTEMPTS:
            con.execute("UPDATE otps SET attempts=0, code_hash=NULL, locked_until=? WHERE mobile=?",
                        (iso(t + timedelta(minutes=LOCK_MIN)), mobile))
            add_event(con, kind="login_locked", actor=s["name"], role=s["role"], reason="3 wrong OTPs — account locked")
            raise AuthError(423, f"Too many wrong OTPs — locked for {LOCK_MIN} minutes")
        con.execute("UPDATE otps SET attempts=? WHERE mobile=?", (attempts, mobile))
        add_event(con, kind="login_failed", actor=s["name"], role=s["role"], reason="Wrong OTP")
        raise AuthError(401, f"Wrong OTP — {MAX_ATTEMPTS - attempts} attempt(s) left")
    con.execute("UPDATE otps SET code_hash=NULL, attempts=0 WHERE mobile=?", (mobile,))  # one-time use
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
        if parse(data["exp"]) < now():
            raise ValueError
    except Exception:
        raise AuthError(401, "Please log in again")
    s = con.execute("SELECT * FROM staff WHERE id=? AND active=1", (data["sid"],)).fetchone()
    if not s:
        raise AuthError(401, "Account deactivated")
    return s
