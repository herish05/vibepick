import os

from .base import VisionProvider
from .heuristic import HeuristicProvider

_REGISTRY: dict[str, type[VisionProvider]] = {"heuristic": HeuristicProvider}


def get_provider(name: str | None = None) -> VisionProvider:
    name = (name or os.environ.get("AI_PROVIDER", "heuristic")).lower()
    if name not in _REGISTRY:
        raise RuntimeError(f"Unknown AI_PROVIDER '{name}'. Available: {sorted(_REGISTRY)}")
    return _REGISTRY[name]()
