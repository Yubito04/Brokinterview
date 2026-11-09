from datetime import date

from app.llm import ExtractedJob


class FakeJobExtractor:
    """Stands in for the real extractor: no network, no cost, same answer every time."""

    def __init__(self, result: ExtractedJob | None = None, error: Exception | None = None):
        self.result = result
        self.error = error
        self.calls: list[tuple[str, date]] = []

    def extract(self, text: str, today: date) -> ExtractedJob:
        self.calls.append((text, today))
        if self.error is not None:
            raise self.error
        return self.result
