import io

import pytest
from fastapi.testclient import TestClient
from PIL import Image

from app.main import app

client = TestClient(app)


def solid(color, size=(64, 64), fmt="PNG") -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", size, color).save(buf, fmt)
    return buf.getvalue()


def analyze(data: bytes):
    return client.post("/image/analyze", files={"file": ("x.png", data, "image/png")})


def test_health():
    assert client.get("/health").json()["status"] == "ok"


def test_analyze_returns_full_vibe_vector_and_embedding():
    r = analyze(solid((200, 120, 60)))
    assert r.status_code == 200
    body = r.json()
    assert len(body["vibe"]) == 13
    assert all(0 <= v <= 1 for v in body["vibe"].values())
    assert len(body["embedding"]) == 33
    assert body["structured"]["semantic_understanding"] is False
    assert body["confidence"] < 0.5


def test_dark_cool_image_is_sadder_than_bright_warm():
    dark = analyze(solid((20, 25, 50))).json()["vibe"]
    bright = analyze(solid((255, 210, 120))).json()["vibe"]
    assert dark["sad"] > bright["sad"]
    assert bright["happy"] > dark["happy"]
    assert analyze(solid((20, 25, 50))).json()["structured"]["time_context"] == "night"


def test_deterministic():
    d = solid((90, 140, 200))
    assert analyze(d).json() == analyze(d).json()


def test_corrupt_image_rejected():
    assert analyze(b"not an image").status_code == 422


@pytest.mark.parametrize("path", ["/video/analyze"])
def test_video_not_implemented(path):
    assert client.post(path).status_code == 501


def test_music_and_user_embed_share_space():
    song = client.post("/music/embed", json={"mood": {"party": 0.9}, "energy": 0.8, "tempo": 120}).json()
    user = client.post("/user/embed", json={"vibes": {"party": 0.8}, "energy": 0.7}).json()
    assert song["dims"] == user["dims"] and len(song["embedding"]) == len(user["embedding"])


def test_rank_orders_by_weighted_signals():
    r = client.post("/recommend/rank", json={
        "weights": {"visual_match": 0.7, "trend_score": 0.3},
        "items": [{"song_id": "a", "signals": {"visual_match": 0.2, "trend_score": 1}},
                  {"song_id": "b", "signals": {"visual_match": 0.9, "trend_score": 0}}],
    }).json()
    assert [x["song_id"] for x in r["ranked"]] == ["b", "a"]


def test_feedback_process():
    d = client.post("/feedback/process", json={"rating": "not_my_vibe", "reasons": ["wrong_language"]}).json()
    assert d["weight"] < 0 and d["adjustments"]["language_match"] > 0
