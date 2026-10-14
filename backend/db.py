"""SQLite schema + helpers. Events are append-only (triggers) and SHA-256 hash-chained."""
import hashlib
import hmac
import json
import os
import secrets
import sqlite3
from datetime import datetime, timedelta, timezone

DB_PATH = os.environ.get("CIVIC_DB", os.path.join(os.path.dirname(__file__), "civic.db"))
IST = timezone(timedelta(hours=5, minutes=30))

SCHEMA = """
CREATE TABLE IF NOT EXISTS departments (id TEXT PRIMARY KEY, name TEXT, name_ta TEXT);
CREATE TABLE IF NOT EXISTS wards (id INTEGER PRIMARY KEY, name TEXT, lat REAL, lng REAL);
CREATE TABLE IF NOT EXISTS rules (
  id INTEGER PRIMARY KEY, category TEXT, ward_id INTEGER, dept_id TEXT, keywords TEXT,
  ack_hours REAL, resolve_hours REAL, version INTEGER, active INTEGER DEFAULT 1);
CREATE TABLE IF NOT EXISTS staff (
  id INTEGER PRIMARY KEY, name TEXT, designation TEXT, mobile TEXT UNIQUE,
  role TEXT CHECK (role IN ('triage','officer','supervisor','admin')), dept_id TEXT, active INTEGER DEFAULT 1);
CREATE TABLE IF NOT EXISTS otps (
  mobile TEXT PRIMARY KEY, code_hash TEXT, expires_at TEXT, attempts INTEGER DEFAULT 0,
  last_sent TEXT, fails INTEGER DEFAULT 0, locked_until TEXT);
CREATE TABLE IF NOT EXISTS sms_outbox (id INTEGER PRIMARY KEY, to_mobile TEXT, message TEXT, at TEXT);
CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY, text TEXT, category TEXT, lat REAL, lng REAL, ward_id INTEGER, landmark TEXT,
  photo TEXT, contact TEXT, created_at TEXT, issue_id TEXT, token TEXT);
CREATE TABLE IF NOT EXISTS issues (
  id TEXT PRIMARY KEY, category TEXT, lat REAL, lng REAL, ward_id INTEGER, dept_id TEXT, status TEXT,
  priority INTEGER DEFAULT 1, created_at TEXT, ack_due TEXT, resolve_due TEXT, acknowledged_at TEXT,
  resolved_at TEXT, closed_at TEXT, verified INTEGER, escalated INTEGER DEFAULT 0, bounce_count INTEGER DEFAULT 0,
  rule_version INTEGER, sla_reason TEXT, closure_reason TEXT, evidence TEXT);
CREATE TABLE IF NOT EXISTS links (
  id INTEGER PRIMARY KEY, report_id TEXT, issue_id TEXT, active INTEGER DEFAULT 1,
  linked_by TEXT, reason TEXT, created_at TEXT);
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY, issue_id TEXT, report_id TEXT, kind TEXT, from_status TEXT, to_status TEXT,
  actor TEXT, role TEXT, reason TEXT, public_note TEXT, created_at TEXT, prev_hash TEXT, hash TEXT);
CREATE TABLE IF NOT EXISTS notifications (id INTEGER PRIMARY KEY, report_id TEXT, message TEXT, at TEXT);
CREATE TABLE IF NOT EXISTS labels (report_id TEXT PRIMARY KEY, true_dept TEXT, true_cluster TEXT, split TEXT);
CREATE TRIGGER IF NOT EXISTS events_no_update BEFORE UPDATE ON events
  BEGIN SELECT RAISE(ABORT, 'audit events are append-only'); END;
CREATE TRIGGER IF NOT EXISTS events_no_delete BEFORE DELETE ON events
  BEGIN SELECT RAISE(ABORT, 'audit events are append-only'); END;
"""

KEY_PATH = os.path.join(os.path.dirname(__file__), ".audit_key")


def _audit_key() -> bytes:
    """Server-held key: an insider who edits rows can't just recompute the chain (HMAC, not bare SHA-256)."""
    if os.environ.get("CIVIC_AUDIT_KEY"):
        return os.environ["CIVIC_AUDIT_KEY"].encode()
    if not os.path.exists(KEY_PATH):
        with open(KEY_PATH, "w") as f:
            f.write(secrets.token_hex(32))
    with open(KEY_PATH) as f:
        return f.read().strip().encode()


HASH_FIELDS = ("issue_id", "report_id", "kind", "from_status", "to_status", "actor", "role",
               "reason", "public_note", "created_at")


def now() -> datetime:
    return datetime.now(IST).replace(microsecond=0)


def iso(dt: datetime) -> str:
    return dt.isoformat()


def parse(s: str) -> datetime:
    return datetime.fromisoformat(s)


def connect() -> sqlite3.Connection:
    con = sqlite3.connect(DB_PATH, check_same_thread=False)
    con.row_factory = sqlite3.Row
    con.execute("PRAGMA foreign_keys=ON")
    return con


def init(con: sqlite3.Connection):
    con.executescript(SCHEMA)


def event_hash(prev_hash: str, ev: dict) -> str:
    payload = json.dumps([ev.get(k) for k in HASH_FIELDS], ensure_ascii=False)
    return hmac.new(_audit_key(), (prev_hash + payload).encode(), hashlib.sha256).hexdigest()


def add_event(con, *, issue_id=None, report_id=None, kind, from_status=None, to_status=None,
              actor="system", role="system", reason=None, public_note=None, at=None):
    row = con.execute("SELECT hash FROM events ORDER BY id DESC LIMIT 1").fetchone()
    prev = row["hash"] if row else "GENESIS"
    ev = dict(issue_id=issue_id, report_id=report_id, kind=kind, from_status=from_status,
              to_status=to_status, actor=actor, role=role, reason=reason, public_note=public_note,
              created_at=iso(at or now()))
    h = event_hash(prev, ev)
    con.execute(f"INSERT INTO events ({','.join(HASH_FIELDS)}, prev_hash, hash) VALUES "
                f"({','.join('?' * len(HASH_FIELDS))}, ?, ?)", [ev[k] for k in HASH_FIELDS] + [prev, h])
    return h


def verify_chain(con) -> dict:
    prev, n = "GENESIS", 0
    for r in con.execute("SELECT * FROM events ORDER BY id"):
        n += 1
        if r["prev_hash"] != prev or event_hash(prev, dict(r)) != r["hash"]:
            return {"ok": False, "checked": n, "broken_at": r["id"]}
        prev = r["hash"]
    return {"ok": True, "checked": n, "broken_at": None}
