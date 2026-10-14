"""Evaluation on the labelled synthetic set (test split): routing, duplicate clustering, latency, overdue rate."""
import statistics

import db
import engine
import workflow

_cache: dict = {}


def pairwise_prf(pred: set, true: set) -> dict:
    tp = len(pred & true)
    p = tp / len(pred) if pred else 0.0
    r = tp / len(true) if true else 0.0
    return {"precision": round(p, 3), "recall": round(r, 3), "f1": round(2 * p * r / (p + r) if p + r else 0.0, 3)}


def bcubed_f1(pred: list, true: list) -> float:
    """pred/true: cluster label per item (same order)."""
    n = len(true)
    if not n:
        return 0.0
    p = r = 0.0
    for i in range(n):
        same_pred = {j for j in range(n) if pred[j] == pred[i]}
        same_true = {j for j in range(n) if true[j] == true[i]}
        both = len(same_pred & same_true)
        p += both / len(same_pred)
        r += both / len(same_true)
    p, r = p / n, r / n
    return round(2 * p * r / (p + r), 3) if p + r else 0.0


def _clusters(n, pairs):
    parent = list(range(n))

    def find(x):
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x
    for i, j in pairs:
        parent[find(i)] = find(j)
    return [find(i) for i in range(n)]


def _candidates(rows, times):
    """For each report j: earlier reports i passing retrieval filters, as (i, dist_m, hours)."""
    out = []
    for j, b in enumerate(rows):
        c = []
        for i in range(j):
            a = rows[i]
            if a["category"] and b["category"] and a["category"] != b["category"]:
                continue
            d = engine.haversine_m(a["lat"], a["lng"], b["lat"], b["lng"])
            h = (times[j] - times[i]).total_seconds() / 3600
            if d <= engine.DUP_RADIUS_M and h <= engine.DUP_WINDOW_H:
                c.append((i, d, h))
        out.append(c)
    return out


def similarities(rows, cands, mode):
    """{(i, j): raw similarity} for every retrieved pair."""
    sims = {}
    for j, c in enumerate(cands):
        if c:
            for (i, _, _), s in zip(c, engine.similarity(rows[j]["text"], [rows[i]["text"] for i, _, _ in c], mode)):
                sims[(i, j)] = s
    return sims


def duplicates(rows, times, mode, cands=None):
    m = engine.mode_used(mode)
    cands = cands if cands is not None else _candidates(rows, times)
    sims = similarities(rows, cands, m)
    truth = [r["true_cluster"] for r in rows]
    true_pairs = {(i, j) for j in range(len(rows)) for i in range(j) if truth[i] == truth[j]}
    pred_pairs, hits, total = set(), 0, 0
    for j, c in enumerate(cands):
        scored = sorted(((engine.pair_score(sims[(i, j)], d, h, m), i) for i, d, h in c), reverse=True)
        pred_pairs |= {(i, j) for s, i in scored if s >= engine.DUP_THRESHOLD}
        if any(truth[i] == truth[j] for i in range(j)):
            total += 1
            hits += any(truth[i] == truth[j] for _, i in scored[:5])
    out = pairwise_prf(pred_pairs, true_pairs)
    out["bcubed_f1"] = bcubed_f1(_clusters(len(rows), pred_pairs), truth)
    out["recall_at_5"] = round(hits / total, 3) if total else 0.0
    return out


def routing(rows):
    true, pred, top3 = [], [], 0
    for r in rows:
        routes = engine.route(r["text"], r["category"], r["ward"] or "")
        true.append(r["true_dept"])
        pred.append(routes[0]["dept_id"])
        top3 += r["true_dept"] in [x["dept_id"] for x in routes]
    labels = [d for d in engine.DEPARTMENTS if d in set(true) | set(pred)]
    idx = {d: k for k, d in enumerate(labels)}
    matrix = [[0] * len(labels) for _ in labels]
    for t, p in zip(true, pred):
        matrix[idx[t]][idx[p]] += 1
    f1s = []
    for d in sorted(set(true)):
        tp = sum(t == p == d for t, p in zip(true, pred))
        fp, fn = sum(p == d != t for t, p in zip(true, pred)), sum(t == d != p for t, p in zip(true, pred))
        f1s.append(2 * tp / (2 * tp + fp + fn) if tp else 0.0)
    n = len(rows) or 1
    return {"top1": round(sum(t == p for t, p in zip(true, pred)) / n, 3), "top3": round(top3 / n, 3),
            "macro_f1": round(sum(f1s) / len(f1s), 3) if f1s else 0.0,
            "confusion": {"labels": labels, "matrix": matrix}}


def test_rows(con):
    rows = con.execute("SELECT r.*, l.true_dept, l.true_cluster, w.name AS ward FROM reports r "
                       "JOIN labels l ON l.report_id=r.id LEFT JOIN wards w ON w.id=r.ward_id "
                       "WHERE l.split='test' ORDER BY r.created_at, r.id").fetchall()
    return rows, [db.parse(r["created_at"]) for r in rows]


def evaluate(con) -> dict:
    key = con.execute("SELECT COUNT(*) FROM labels").fetchone()[0]  # labelled set is static → cache the slow part
    ai = engine.ai_available()
    if (key, ai) not in _cache:
        rows, times = test_rows(con)
        cands = _candidates(rows, times)
        _cache[(key, ai)] = {
            "note": f"Synthetic labelled data (fictional Coimbatore pilot) — not real-world results. "
                    f"Test split: {len(rows)} reports / {len({r['true_cluster'] for r in rows})} clusters.",
            "routing": routing(rows),
            "duplicates": {"ai": duplicates(rows, times, "ai", cands) if ai else None,
                           "baseline": duplicates(rows, times, "baseline", cands)}}
    static = _cache[(key, ai)]

    hours = sorted((db.parse(i["resolved_at"]) - db.parse(i["created_at"])).total_seconds() / 3600
                   for i in con.execute("SELECT created_at, resolved_at FROM issues WHERE resolved_at IS NOT NULL"))
    p90 = statistics.quantiles(hours, n=10, method="inclusive")[8] if len(hours) > 1 else (hours[0] if hours else None)
    now = db.now()
    open_ = con.execute(f"SELECT * FROM issues WHERE status IN ({','.join('?' * len(workflow.OPEN))})",
                        workflow.OPEN).fetchall()
    overdue = sum(workflow.is_overdue(i, now) for i in open_)

    return {
        "dataset": {"reports": key, "issues": con.execute("SELECT COUNT(*) FROM issues").fetchone()[0],
                    "note": static["note"]},
        "routing": static["routing"],
        "duplicates": static["duplicates"],
        "latency": {"median_h": round(statistics.median(hours), 1) if hours else None,
                    "p90_h": round(p90, 1) if p90 is not None else None},
        "overdue_rate": round(overdue / len(open_), 3) if open_ else 0.0,
        "model": "intfloat/multilingual-e5-small (offline)" if ai else "TF-IDF char n-gram baseline (AI model unavailable)",
    }
