from abc import ABC, abstractmethod

from ..schemas import ImageAnalysis


class VisionProvider(ABC):
    """Swap implementations (hosted VLM, local CLIP, ...) without touching routes."""

    name: str

    @abstractmethod
    def analyze_image(self, data: bytes) -> ImageAnalysis: ...

    @abstractmethod
    def embed_image(self, data: bytes) -> list[float]: ...
