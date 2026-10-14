"""Deterministic, dependency-light baseline vision provider.

It derives *measurable* low-level features (brightness, warmth, saturation, contrast, colorfulness,
edge density) and maps them to the standard Vibe Vector with explicit rules. It does NOT understand
scene semantics (people, occasion). A semantic provider (VLM/CLIP) plugs in via AI_PROVIDER.
"""

import io

import numpy as np
from PIL import Image, ImageFilter

from ..constants import VIBE_KEYS
from ..schemas import ImageAnalysis
from .base import VisionProvider


def _clip(x: float) -> float:
    return float(min(1.0, max(0.0, x)))


def load_image(data: bytes) -> Image.Image:
    img = Image.open(io.BytesIO(data))
    img.load()
    img = img.convert("RGB")
    img.thumbnail((128, 128))
    return img


def color_features(img: Image.Image) -> dict[str, float]:
    arr = np.asarray(img, dtype=np.float32) / 255.0
    hsv = np.asarray(img.convert("HSV"), dtype=np.float32) / 255.0
    brightness = float(arr.mean())
    saturation = float(hsv[..., 1].mean())
    warmth = float((arr[..., 0] - arr[..., 2]).mean())  # >0 warm, <0 cool
    contrast = float(arr.std())
    rg = arr[..., 0] - arr[..., 1]
    yb = 0.5 * (arr[..., 0] + arr[..., 1]) - arr[..., 2]
    colorfulness = float(np.sqrt(rg.std() ** 2 + yb.std() ** 2) + 0.3 * np.sqrt(rg.mean() ** 2 + yb.mean() ** 2))
    edges = np.asarray(img.convert("L").filter(ImageFilter.FIND_EDGES), dtype=np.float32) / 255.0
    return {
        "brightness": brightness,
        "saturation": saturation,
        "warmth": warmth,
        "contrast": contrast,
        "colorfulness": colorfulness,
        "edge_density": float(edges.mean()),
    }


def vibe_from_features(f: dict[str, float]) -> dict[str, float]:
    dark = _clip((0.5 - f["brightness"]) * 2.2)
    bright = _clip((f["brightness"] - 0.45) * 2.0)
    warm = _clip(f["warmth"] * 4 + 0.2)
    cool = _clip(-f["warmth"] * 4)
    sat = _clip(f["saturation"] * 1.6)
    busy = _clip(f["edge_density"] * 6)
    contrast = _clip(f["contrast"] * 3)
    colorful = _clip(f["colorfulness"] * 2)
    muted = 1 - sat

    energetic = _clip(0.45 * sat + 0.35 * busy + 0.2 * contrast)
    vibe = {
        "happy": _clip(0.5 * bright + 0.3 * sat + 0.2 * warm),
        "sad": _clip(0.45 * dark + 0.3 * cool + 0.25 * muted),
        "romantic": _clip(0.5 * warm + 0.3 * (1 - busy) + 0.2 * dark),
        "energetic": energetic,
        "chill": _clip(0.5 * (1 - busy) + 0.3 * muted + 0.2 * (1 - contrast)),
        "party": _clip(0.4 * dark * colorful + 0.35 * colorful + 0.25 * busy),
        "aesthetic": _clip(0.4 * (1 - busy) + 0.3 * warm + 0.3 * contrast),
        "cinematic": _clip(0.5 * contrast + 0.3 * dark + 0.2 * cool),
        "nostalgic": _clip(0.5 * warm + 0.3 * muted + 0.2 * (1 - sat)),
        "confident": _clip(0.5 * contrast + 0.3 * dark + 0.2 * energetic),
        "peaceful": _clip(0.5 * (1 - busy) + 0.3 * bright + 0.2 * cool),
        "funny": _clip(0.6 * colorful + 0.4 * bright),
        "emotional": _clip(0.4 * dark + 0.3 * contrast + 0.3 * muted),
    }
    return {k: round(vibe[k], 3) for k in VIBE_KEYS}


def embedding_from(img: Image.Image, features: dict[str, float]) -> list[float]:
    """27-bin RGB histogram (3x3x3) + 6 summary stats, L2-normalised. Placeholder for CLIP-style embeddings."""
    arr = (np.asarray(img, dtype=np.float32) / 255.0 * 2.999).astype(int).reshape(-1, 3)
    idx = arr[:, 0] * 9 + arr[:, 1] * 3 + arr[:, 2]
    hist = np.bincount(idx, minlength=27).astype(np.float32)
    hist /= max(hist.sum(), 1.0)
    vec = np.concatenate([hist, np.array(list(features.values()), dtype=np.float32)])
    norm = float(np.linalg.norm(vec))
    return [round(float(x), 5) for x in (vec / norm if norm else vec)]


class HeuristicProvider(VisionProvider):
    name = "heuristic"

    def analyze_image(self, data: bytes) -> ImageAnalysis:
        img = load_image(data)
        f = color_features(img)
        vibe = vibe_from_features(f)
        time_context = "night" if f["brightness"] < 0.3 else "day" if f["brightness"] > 0.55 else "evening"
        lighting = "warm" if f["warmth"] > 0.05 else "cool" if f["warmth"] < -0.05 else "neutral"
        top = sorted(vibe.items(), key=lambda kv: kv[1], reverse=True)[:3]
        structured = {
            "time_context": time_context,
            "lighting": lighting,
            "energy": round(vibe["energetic"], 3),
            "mood": top[0][0],
            "aesthetic": [k for k, v in top if v > 0.35],
            "low_level": {k: round(v, 4) for k, v in f.items()},
            "semantic_understanding": False,
        }
        # Low confidence: colour statistics alone cannot confirm scene/occasion.
        return ImageAnalysis(
            structured=structured,
            vibe=vibe,
            embedding=embedding_from(img, f),
            provider=self.name,
            confidence=0.35,
        )

    def embed_image(self, data: bytes) -> list[float]:
        img = load_image(data)
        return embedding_from(img, color_features(img))
