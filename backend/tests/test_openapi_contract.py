from app.openapi_export import OPENAPI_PATH, render_openapi


def test_committed_openapi_matches_the_app():
    # If this fails, the API changed but backend/openapi.json (and so the frontend
    # types) was not regenerated. Fix: python -m scripts.export_openapi
    # then: npm run generate:api in frontend/.
    committed = OPENAPI_PATH.read_bytes().decode("utf-8")
    # Git on Windows may check the file out with CRLF line endings: that is not a
    # real difference, so it is normalised before comparing.
    committed = committed.replace("\r\n", "\n")

    assert committed == render_openapi(), (
        "backend/openapi.json is out of date: run `python -m scripts.export_openapi`"
    )
