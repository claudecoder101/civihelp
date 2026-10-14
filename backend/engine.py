"""Routing (rules + reasons) and duplicate detection (multilingual embeddings + distance + time)."""
import math
import threading
import os
import re

APP_NAME = os.environ.get("APP_NAME", "CivicResolve")  # working name — rename here (+ frontend/src/brand.js)

CATEGORIES = {
    "roads": ("Roads & potholes", "சாலை / பள்ளம்"),
    "garbage": ("Garbage & waste", "குப்பை"),
    "streetlight": ("Streetlights", "தெருவிளக்கு"),
    "drainage": ("Drainage & sewage", "வடிகால் / சாக்கடை"),
    "water": ("Water supply", "குடிநீர்"),
}
DEPARTMENTS = {
    "roads": ("Roads & Bridges Dept", "சாலைகள் துறை"),
    "waste": ("Solid Waste Management", "திடக்கழிவு மேலாண்மை"),
    "electrical": ("Electrical (Streetlights)", "மின் பிரிவு"),
    "drainage": ("Drainage & Sewerage", "வடிகால் பிரிவு"),
    "water": ("Water Supply Dept", "குடிநீர் வழங்கல்"),
    "triage": ("Manual Triage Desk", "கைமுறை பரிசீலனை"),
}
# Demo pilot: Coimbatore neighbourhoods as fictional service wards (approximate centroids).
CITY = {"name": "Coimbatore (demo pilot)", "lat": 11.0168, "lng": 76.9558}
WARDS = [
    (1, "Gandhipuram", 11.0183, 76.9725), (2, "RS Puram", 11.0089, 76.9507),
    (3, "Peelamedu", 11.0272, 77.0026), (4, "Saibaba Colony", 11.0247, 76.9447),
    (5, "Town Hall", 10.9948, 76.9617), (6, "Ukkadam", 10.9862, 76.9622),
    (7, "Singanallur", 11.0004, 77.0285), (8, "Ganapathy", 11.0410, 76.9810),
    (9, "Vadavalli", 11.0255, 76.9030), (10, "Kuniyamuthur", 10.9600, 76.9500),
]
# category -> (dept, keywords EN+TA, ack_hours, resolve_hours). Targets are fictional demo values.
RULES = {
    "roads": ("roads", "pothole,road,crack,asphalt,speed breaker,broken road,damaged road,tar,"
              "பள்ளம்,சாலை,குழி,ரோடு", 24, 72),
    "garbage": ("waste", "garbage,waste,trash,bin,dustbin,litter,dump,rubbish,smell,"
                "குப்பை,தொட்டி,நாற்றம்,கழிவு", 6, 24),
    "streetlight": ("electrical", "streetlight,street light,lamp,light,bulb,dark,pole,"
                    "தெருவிளக்கு,விளக்கு,இருட்டு,மின்கம்பம்", 12, 48),
    "drainage": ("drainage", "drain,drainage,sewage,sewer,gutter,manhole,stagnant,blocked,clogged,"
                 "சாக்கடை,வடிகால்,கழிவுநீர்,தேங்கி", 12, 48),
    "water": ("water", "water,supply,pipe,leak,tap,drinking,contaminated,no water,pipeline,"
              "குடிநீர்,தண்ணீர்,குழாய்", 6, 24),
}
RULE_VERSION = 2
HIGH, MEDIUM = 0.7, 0.45
DUP_RADIUS_M, DUP_WINDOW_H, DUP_THRESHOLD = 300, 168, 0.45  # tuned on the tune split only; staff approve every link

TAMIL = re.compile(r"[஀-௿]")


def is_tamil(text: str) -> bool:
    return bool(TAMIL.search(text or ""))


def haversine_m(lat1, lng1, lat2, lng2) -> float:
    p = math.pi / 180
    a = (math.sin((lat2 - lat1) * p / 2) ** 2
         + math.cos(lat1 * p) * math.cos(lat2 * p) * math.sin((lng2 - lng1) * p / 2) ** 2)
    return 2 * 6371000 * math.asin(math.sqrt(a))


def ward_for(lat, lng):
    return min(WARDS, key=lambda w: haversine_m(lat, lng, w[2], w[3]))


def route(text: str, category: str | None, ward_name: str = "") -> list[dict]:
    """Top-3 departments with score, tier and plain-language reasons."""
    low = (text or "").lower()
    out = []
    for cat, (dept, kws, ack_h, res_h) in RULES.items():
        hits = [k for k in kws.split(",") if k in low]
        kw = min(len(hits) / 2, 1.0)
        cat_match = category == cat
        score = 0.6 * cat_match + 0.4 * kw if category else 0.85 * kw
        if score <= 0:
            continue
        reasons = []
        if cat_match:
            reasons.append(f"Category '{CATEGORIES[cat][0]}' → {DEPARTMENTS[dept][0]} (rule v{RULE_VERSION})")
        if hits:
            reasons.append("Keywords: " + ", ".join(f"'{h}'" for h in hits[:4]))
        if ward_name:
            reasons.append(f"{ward_name} is inside this department's service area")
        reasons.append(f"Target: acknowledge in {ack_h} h, resolve in {res_h} h")
        out.append({"dept_id": dept, "dept_name": DEPARTMENTS[dept][0], "category": cat,
                    "score": round(score, 2), "reasons": reasons})
    out.sort(key=lambda r: -r["score"])
    out = out[:3]
    if not out:
        out = [{"dept_id": "triage", "dept_name": DEPARTMENTS["triage"][0], "category": None, "score": 0.0,
                "reasons": ["No rule or keyword matched — a person must review this report"]}]
    for r in out:
        r["tier"] = "high" if r["score"] >= HIGH else "medium" if r["score"] >= MEDIUM else "low"
    if len(out) > 1 and out[0]["score"] - out[1]["score"] < 0.1 and out[0]["tier"] == "high":
        out[0]["tier"] = "medium"  # two departments nearly tied → a person confirms
        out[0]["reasons"].append(f"Close call with {out[1]['dept_name']} — please confirm")
    return out


# ---------- text similarity ----------
MODEL_DIR = os.path.join(os.path.dirname(__file__), "models", "e5-small")
# e5 cosine is compressed (unrelated civic text ~0.80, same issue ~0.81-0.96); rescale that band. Tuned on tune split.
SIM_RANGE = {"ai": (0.79, 0.90), "baseline": (0.0, 0.5)}
_model = None
_model_failed = False
_cache: dict = {}


_load_lock = threading.Lock()


def ai_available() -> bool:
    global _model, _model_failed
    with _load_lock:  # startup warm-up and first request may race
        if _model is None and not _model_failed:
            try:
                if not os.path.isdir(MODEL_DIR):
                    raise FileNotFoundError(MODEL_DIR)
                os.environ.setdefault("HF_HUB_OFFLINE", "1")
                from sentence_transformers import SentenceTransformer
                _model = SentenceTransformer(MODEL_DIR, device="cpu")
            except Exception as e:  # fall back to TF-IDF; demo must never break
                print("AI model unavailable, using TF-IDF baseline:", e)
                _model_failed = True
    return _model is not None


def _embed(texts):
    missing = [t for t in texts if t not in _cache]
    if missing:
        vecs = _model.encode(["query: " + t for t in missing], normalize_embeddings=True)
        _cache.update(zip(missing, vecs))
    return [_cache[t] for t in texts]


def similarity(a: str, others: list[str], mode: str = "ai") -> list[float]:
    """Raw cosine similarity of `a` to each text in `others`."""
    if not others:
        return []
    if mode == "ai" and ai_available():
        va, *vo = _embed([a] + others)
        return [float(va @ v) for v in vo]
    from sklearn.feature_extraction.text import TfidfVectorizer
    m = TfidfVectorizer(analyzer="char_wb", ngram_range=(3, 5)).fit_transform([a] + others)
    return [float(x) for x in (m[1:] @ m[0].T).toarray().ravel()]


def mode_used(mode: str) -> str:
    return "ai" if mode == "ai" and ai_available() else "baseline"


def meaning(sim: float, mode: str) -> float:
    """Calibrated 0-1 meaning match (raw cosine is compressed and would mislead if shown as a %)."""
    lo, hi = SIM_RANGE[mode]
    return max(0.0, min(1.0, (sim - lo) / (hi - lo)))


def pair_score(sim: float, dist_m: float, hours: float, mode: str) -> float:
    s = meaning(sim, mode)
    return round(0.6 * s + 0.25 * (1 - dist_m / DUP_RADIUS_M) + 0.15 * (1 - hours / DUP_WINDOW_H), 3)


def dup_candidates(text, category, lat, lng, at, issues, mode="ai"):
    """issues: [{id, category, status, report_count, reports:[{text, lat, lng, created_at(datetime)}]}]
    Two-step: retrieve by distance/time/category, then rank by meaning + distance + time."""
    m = mode_used(mode)
    out = []
    for iss in issues:
        if category and iss["category"] and iss["category"] != category:
            continue
        near = [(r, haversine_m(lat, lng, r["lat"], r["lng"]), abs((at - r["created_at"]).total_seconds()) / 3600)
                for r in iss["reports"]]
        near = [x for x in near if x[1] <= DUP_RADIUS_M and x[2] <= DUP_WINDOW_H]
        if not near:
            continue
        sims = similarity(text, [r["text"] for r, _, _ in near], m)
        best = max(range(len(near)), key=lambda i: pair_score(sims[i], near[i][1], near[i][2], m))
        r, d, h = near[best]
        score = pair_score(sims[best], d, h, m)
        mean = meaning(sims[best], m)
        reasons = [f"Meaning match: {round(mean * 100)}%" + (" (AI, multilingual)" if m == "ai" else " (word match)"),
                   f"{round(d)} m away", f"{round(h, 1)} h apart"]
        if is_tamil(text) != is_tamil(r["text"]):
            reasons.insert(0, "Cross-language match (Tamil ↔ English)")
        if iss["category"] == category and category:
            reasons.append("Same category")
        out.append({"issue_id": iss["id"], "score": score, "similarity": round(mean, 3), "raw_cosine": round(sims[best], 3),
                    "distance_m": round(d), "hours_apart": round(h, 1), "category": iss["category"],
                    "sample_text": r["text"], "report_count": iss["report_count"], "status": iss["status"],
                    "reasons": reasons, "probable": score >= DUP_THRESHOLD})
    out.sort(key=lambda c: -c["score"])
    return [c for c in out if c["score"] >= DUP_THRESHOLD / 2][:5]  # hide clearly-unrelated nearby issues
