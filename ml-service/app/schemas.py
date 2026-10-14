from typing import Any

from pydantic import BaseModel, Field


class ImageAnalysis(BaseModel):
    structured: dict[str, Any]
    vibe: dict[str, float]
    embedding: list[float] = Field(default_factory=list)
    provider: str
    confidence: float = Field(ge=0, le=1)


class ImageEmbedding(BaseModel):
    embedding: list[float]
    provider: str


class SongDna(BaseModel):
    mood: dict[str, float] = {}
    aesthetic: dict[str, float] = {}
    energy: float = Field(0.5, ge=0, le=1)
    danceability: float = Field(0.5, ge=0, le=1)
    tempo: float = Field(100, ge=30, le=250)


class VectorResponse(BaseModel):
    embedding: list[float]
    dims: list[str]


class TasteInput(BaseModel):
    vibes: dict[str, float] = {}
    energy: float = 0.5


class RankItem(BaseModel):
    song_id: str
    signals: dict[str, float]


class RankRequest(BaseModel):
    items: list[RankItem] = Field(max_length=500)
    weights: dict[str, float]


class RankResponse(BaseModel):
    ranked: list[dict[str, Any]]
    model: str


class FeedbackInput(BaseModel):
    rating: str
    reasons: list[str] = []


class FeedbackDelta(BaseModel):
    weight: float
    adjustments: dict[str, float]
