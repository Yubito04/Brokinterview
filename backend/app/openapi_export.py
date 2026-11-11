import json
from pathlib import Path

from app.main import app

# The committed copy of the API description: the "contract" the frontend types
# are generated from. Lives next to the backend code, found from this file's location.
OPENAPI_PATH = Path(__file__).resolve().parent.parent / "openapi.json"


def render_openapi() -> str:
    # The ONE place that decides how the schema becomes text. The export script
    # and the staleness test both call it, so they can never disagree on formatting.
    # sort_keys + fixed indent + trailing newline = same input, same bytes.
    return json.dumps(app.openapi(), indent=2, sort_keys=True, ensure_ascii=False) + "\n"
