# Civihelp API (backend: FastAPI on http://localhost:8000)

All JSON. Staff endpoints need header `Authorization: Bearer <token>`.
Times are ISO-8601 strings (IST, e.g. `2026-10-14T22:10:00+05:30`).

## Enums
- categories: `roads`, `garbage`, `streetlight`, `drainage`, `water`
- issue status: `Assigned`, `Acknowledged`, `In progress`, `Resolved`, `Closed`, `Reopened`
- report public status: `Triage` (not yet linked to an issue) or the issue's status
- roles: `triage`, `officer`, `supervisor`, `admin`
- routing tier: `high`, `medium`, `low` (low = "Needs review")

## Public (resident)
### GET /api/meta
`{ categories:[{id,name,name_ta}], departments:[{id,name,name_ta}], wards:[{id,name,lat,lng}], city:{name,lat,lng} }`

### POST /api/reports/check  (pre-submit "already reported nearby?")
body `{ text, category|null, lat, lng }`
→ `{ ward:{id,name}, routing:[Route], duplicates:[DupCandidate] }`

Route = `{ dept_id, dept_name, score (0-1), tier, reasons:[string] }` (max 3, best first)
DupCandidate = `{ issue_id, score (0-1), similarity (0-1), distance_m, hours_apart, category, sample_text, report_count, status, reasons:[string], probable:bool }`

### POST /api/reports
body `{ text, category|null, lat, lng, landmark|null, contact|null, photo_base64|null, follow_issue_id|null }`
→ `{ id:"CV-0042", status, ward, next_steps:string, issue_id|null }`
(`follow_issue_id` = resident chose "Follow this issue" → linked immediately.)

### GET /api/reports/{id}
→ `{ id, text, category, ward, landmark, created_at, status, issue: null | { id, dept_name, status, report_count, ack_due, resolve_due, sla_reason, escalated, closure_reason, evidence }, timeline:[{at, status, public_note}], notifications:[{at, message}], can_confirm:bool, confirmations: null | { have, need, mine }, dispatch: null | { owner, status, next_step, next_due, hops:[{from, to, sent_at, received_at}] } }`
(no contact, no internal notes, no officer names)

### POST /api/reports/{id}/confirm
body `{ fixed: bool, note|null }` → fixed=true closes (verified), false reopens. Only when status `Resolved`.

### GET /open311/requests.json
Open311 GeoReport v2-style list of service requests.

## Auth (staff: registered govt mobile + OTP)
### POST /api/auth/request-otp  body `{ mobile }` → `{ ok:true, cooldown_s:30 }` (403 if not in staff directory or inactive; 429 if cooldown/locked)
### POST /api/auth/verify-otp  body `{ mobile, code }` → `{ token, staff:{id,name,designation,role,dept_id,dept_name} }` (401 wrong/expired, 423 locked)
### GET /api/demo/sms-inbox → `[{to, message, at}]` latest first (DEMO ONLY — simulated SMS)
### GET /api/demo/staff → staff directory for the login page hint `[{name, designation, role, dept_name, mobile}]`
### GET /api/me → staff

## Staff
### GET /api/triage  (triage, supervisor, admin)
→ `[{ report:{id,text,category,ward,landmark,lat,lng,created_at,photo_url}, routing:[Route], duplicates:[DupCandidate] }]` unlinked reports, oldest first

### POST /api/triage/{report_id}/create-issue  body `{ dept_id, note|null }` → Issue
### POST /api/triage/{report_id}/link  body `{ issue_id, reason|null }` → Issue
### POST /api/links/{link_id}/unlink  body `{ reason }` → `{ok}` (report goes back to triage)

### GET /api/issues?status=&dept_id=&overdue=1  (officer: own dept only)
→ `[IssueSummary]` = `{ id, category, dept_id, dept_name, ward, status, priority, report_count, created_at, ack_due, resolve_due, overdue:bool, escalated:bool, bounce_count, lat, lng }`

### GET /api/issues/{id}
→ IssueSummary + `{ sla_reason, rule_version, closure_reason, evidence, verified:null|bool, reports:[{id,text,created_at,link_id,linked_by,link_reason}], events:[Event], allowed_actions:[string] }`
Event = `{ id, kind, from_status, to_status, actor, role, reason, public_note, created_at, hash, prev_hash }`

### POST /api/issues/{id}/transition
body `{ to, reason|null, public_note|null, closure_reason|null, evidence|null, new_dept_id|null }`
Rules: officer of the issue's dept: Assigned/Reopened→Acknowledged; Acknowledged→In progress; In progress→In progress (update, public_note required); Acknowledged/In progress→Resolved (closure_reason + evidence required); Assigned→Rejected (reason + new_dept_id required → re-assigned, bounce_count+1). Supervisor/admin: any reassign, Resolved→Closed. 400 on invalid move, 403 on wrong role.
closure_reason ∈ `Repaired`, `No action needed`, `Referred to other authority`, `Could not resolve`

### GET /api/audit/verify → `{ ok:bool, checked:int, broken_at:null|event_id }`
### GET /api/dashboard → `{ counts:{unassigned, awaiting_ack, near_sla, overdue, open, closed}, overdue_by_dept:[{dept,count}], by_category:[{category,open,closed}], ack_hours:{median,p90}, resolve_hours:{median,p90}, overdue_rate, closure_rate, verified_rate, bounce_total, clusters:[{issue_id, report_count}], trend:[{date, submitted, resolved}] }`
### GET /api/hotspots → `{ points:[{issue_id,lat,lng,category,report_count,status,overdue}], table:[{ward, category, reports, issues, overdue}] }`
### GET /api/evaluation → `{ dataset:{reports, issues, note}, routing:{top1, top3, macro_f1, confusion:{labels, matrix}}, duplicates:{ai:{precision,recall,f1,bcubed_f1,recall_at_5}, baseline:{...same}}, latency:{median_h,p90_h}, overdue_rate, model:string }`

Uploaded photos served at `/uploads/<file>`.


## v2 additions (15 Oct)

### GET /api/issues/{id} — new fields
- `dispatch`: `{ owner, status, next_step, next_due, hops:[{ from, to, sent_at, sent_by, reason, sent_hash, received_at, received_by, received_hash }] }` — rebuilt from the audit log. *Sent* = assigned / handed over; *Received* = acknowledged by the receiving department.
- `ai_match`: `null | { model, anchor:{id, text, tamil}, pairs:[{ id, text, tamil, cross_language, meaning (0–1), distance_m, hours }] }` — each linked report vs the first, scored by multilingual-e5-small.

### GET /api/dispatch (staff)
`{ viewpoint, incoming, received, in_progress, awaiting_citizens, sent_waiting }` — issue summaries with `last_hop`, `next_step`, `next_due`. Officers see their department; triage/supervisors see the triage desk.

### POST /api/reports/{id}/confirm — quorum
Closes only when `ceil(30% × linked reporters)` (min 1) distinct reporters confirm; each reporter once (400 on repeat). `fixed:false` from any reporter reopens immediately.

### GET /api/demo/samples
`[{ label, id }]` — fictional tracking IDs: in progress, awaiting confirmation, closed (citizen-verified).
