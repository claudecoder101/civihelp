"""DEMO ONLY: simulate an insider with direct database access quietly rewriting history.
Run: python tamper.py  → then press "Verify chain" in the Audit page: it reports the broken event.
Restore with: python seed.py (re-creates the demo database)."""
import db

con = db.connect()
ev = con.execute("SELECT id, reason FROM events WHERE kind='status' AND to_status='Resolved' ORDER BY id LIMIT 1").fetchone()
if not ev:
    raise SystemExit("No resolved event to tamper with")
con.execute("DROP TRIGGER IF EXISTS events_no_update")  # bypass the app's append-only guard
con.execute("UPDATE events SET reason='Repaired', created_at=datetime('now') WHERE id=?", (ev["id"],))
con.commit()
print(f"Tampered with audit event #{ev['id']} (was: {ev['reason']!r}). Now press 'Verify chain'.")
