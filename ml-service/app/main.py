import os

from fastapi import FastAPI, File, HTTPException, UploadFile

from .constants import VIBE_KEYS
from .providers import get_provider
from .schemas import (
    FeedbackDelta, FeedbackInput, ImageAnalysis, ImageEmbedding, RankRequest, RankResponse,
    SongDna, TasteInput, VectorResponse,
)

MAX_BYTES = int(os.environ.get("MAX_IMAGE_BYTES", 20 * 1024 * 1024))
DIMS = [*VIBE_KEYS, "energy", "danceability", "tempo"]

app = FastAPI(title="VibePick ML Service", version="0.1.0")
provider = get_provider()


async def _read(file: UploadFile) -> bytes:
    data = await file.read(MAX_BYTES + 1)
    if len(data) > MAX_BYTES:
        raise HTTPException(413, "File too large")
    return data


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "provider": provider.name}


@app.post("/image/analyze", response_model=ImageAnalysis)
async def image_analyze(file: UploadFile = File(...)) -> ImageAnalysis:
    data = await _read(file)
    try:
        return provider.analyze_image(data)
    except Exception as exc:  # unreadable/corrupt image
        raise HTTPException(422, "Could not decode image") from exc


@app.post("/image/embed", response_model=ImageEmbedding)
async def image_embed(file: UploadFile = File(...)) -> ImageEmbedding:
    data = await _read(file)
    try:
        return ImageEmbedding(embedding=provider.embed_image(data), provider=provider.name)
    except Exception as exc:
        raise HTTPException(422, "Could not decode image") from exc


@app.post("/video/analyze")
async def video_analyze() -> None:
    raise HTTPException(501, "Video analysis is planned for Phase 8")


@app.post("/music/embed", response_model=VectorResponse)
def music_embed(dna: SongDna) -> VectorResponse:
    merged = {k: 0.6 * dna.mood.get(k, 0.0) + 0.4 * dna.aesthetic.get(k, 0.0) for k in VIBE_KEYS}
    vec = [*(merged[k] for k in VIBE_KEYS), dna.energy, dna.danceability, dna.tempo / 250]
    return VectorResponse(embedding=[round(x, 4) for x in vec], dims=DIMS)


@app.post("/user/embed", response_model=VectorResponse)
def user_embed(taste: TasteInput) -> VectorResponse:
    vec = [*(max(0.0, taste.vibes.get(k, 0.0)) for k in VIBE_KEYS), taste.energy, 0.5, 0.4]
    return VectorResponse(embedding=[round(x, 4) for x in vec], dims=DIMS)


@app.post("/recommend/rank", response_model=RankResponse)
def recommend_rank(req: RankRequest) -> RankResponse:
    total = sum(req.weights.values()) or 1.0
    ranked = [
        {"song_id": i.song_id, "score": round(sum(i.signals.get(k, 0.0) * w for k, w in req.weights.items()) / total, 4)}
        for i in req.items
    ]
    ranked.sort(key=lambda r: r["score"], reverse=True)
    return RankResponse(ranked=ranked, model="weighted-linear-v1")


_RATING_WEIGHT = {"exactly": 1.5, "good": 0.7, "okay": 0.0, "not_my_vibe": -1.0}
_REASON_ADJUST = {
    "wrong_language": {"language_match": 0.02},
    "wrong_mood": {"mood_match": 0.02},
    "doesnt_match_photo": {"visual_match": 0.02},
    "not_trending": {"trend_score": 0.01},
    "too_common": {"trend_score": -0.01},
}


@app.post("/feedback/process", response_model=FeedbackDelta)
def feedback_process(fb: FeedbackInput) -> FeedbackDelta:
    adjustments: dict[str, float] = {}
    for reason in fb.reasons:
        for k, v in _REASON_ADJUST.get(reason, {}).items():
            adjustments[k] = adjustments.get(k, 0.0) + v
    return FeedbackDelta(weight=_RATING_WEIGHT.get(fb.rating, 0.0), adjustments=adjustments)
