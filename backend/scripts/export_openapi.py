"""Write backend/openapi.json from the FastAPI app (no server needed).

Run from the backend folder:  python -m scripts.export_openapi
"""

from app.openapi_export import OPENAPI_PATH, render_openapi


def main() -> None:
    # newline="\n": always LF, even on Windows, so the file does not change
    # depending on who generated it.
    with OPENAPI_PATH.open("w", encoding="utf-8", newline="\n") as file:
        file.write(render_openapi())
    print(f"Wrote {OPENAPI_PATH}")


if __name__ == "__main__":
    main()
