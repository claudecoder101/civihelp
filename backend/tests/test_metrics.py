import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import db  # noqa: E402
import metrics  # noqa: E402
import seed  # noqa: E402


def test_pairwise_prf():
    assert metrics.pairwise_prf({(0, 1), (1, 2)}, {(0, 1), (2, 3)}) == {"precision": 0.5, "recall": 0.5, "f1": 0.5}
    assert metrics.pairwise_prf(set(), {(0, 1)}) == {"precision": 0.0, "recall": 0.0, "f1": 0.0}
    assert metrics.pairwise_prf({(0, 1)}, {(0, 1)})["f1"] == 1.0


def test_bcubed():
    assert metrics.bcubed_f1([1, 1, 2], [1, 1, 2]) == 1.0
    # all merged: P = (2/3+2/3+1/3)/3 = 5/9, R = 1 -> F1 = 10/14
    assert metrics.bcubed_f1([0, 0, 0], ["a", "a", "b"]) == round(10 / 14, 3)
    # all split: P = 1, R = (1/2+1/2+1)/3 = 2/3 -> F1 = 0.8
    assert metrics.bcubed_f1([0, 1, 2], ["a", "a", "b"]) == 0.8


def test_clusters_union_find():
    c = metrics._clusters(4, {(0, 1), (1, 2)})
    assert c[0] == c[1] == c[2] != c[3]


def test_seed_and_evaluate(tmp_path, monkeypatch):
    monkeypatch.setattr(db, "DB_PATH", str(tmp_path / "t.db"))
    con = seed.reset_and_seed()
    assert db.verify_chain(con)["ok"]
    assert con.execute("SELECT COUNT(*) FROM reports WHERE issue_id IS NULL").fetchone()[0] >= 3
    metrics._cache.clear()
    ev = metrics.evaluate(con)
    assert set(ev) == {"dataset", "routing", "duplicates", "latency", "overdue_rate", "model"}
    assert set(ev["routing"]) == {"top1", "top3", "macro_f1", "confusion"}
    assert ev["duplicates"]["baseline"].keys() == {"precision", "recall", "f1", "bcubed_f1", "recall_at_5"}
    con.close()
